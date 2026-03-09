import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadConfig } from '@viberails/config';
import chalk from 'chalk';
import { findProjectRoot } from '../utils/find-project-root.js';
import { confirmDangerous } from '../utils/prompt.js';
import { resolveConfigForFile } from './check-config.js';
import { checkNaming, getAllSourceFiles } from './check-files.js';
import { checkMissingTests } from './check-tests.js';
import { checkGitDirty, getConventionValue, printPlan } from './fix-helpers.js';
import { scanForAliasImports, updateImportsAfterRenames } from './fix-imports.js';
import {
  computeRename,
  deduplicateRenames,
  executeRename,
  type RenameRecord,
} from './fix-naming.js';
import { generateTestStub, type TestStubRecord, writeTestStub } from './fix-tests.js';

const CONFIG_FILE = 'viberails.config.json';

export interface FixOptions {
  dryRun?: boolean;
  rule?: string[];
  yes?: boolean;
}

/**
 * Run the viberails fix command.
 * Detects violations, computes fixes, optionally confirms, then applies.
 */
export async function fixCommand(options: FixOptions, cwd?: string): Promise<number> {
  const startDir = cwd ?? process.cwd();
  const projectRoot = findProjectRoot(startDir);

  if (!projectRoot) {
    console.error(`${chalk.red('Error:')} No package.json found. Are you in a JS/TS project?`);
    return 1;
  }

  const configPath = path.join(projectRoot, CONFIG_FILE);
  if (!fs.existsSync(configPath)) {
    console.error(
      `${chalk.red('Error:')} No viberails.config.json found. Run \`viberails init\` first.`,
    );
    return 1;
  }

  const config = await loadConfig(configPath);

  // Git dirty check — warn but don't block
  if (!options.dryRun) {
    const isDirty = checkGitDirty(projectRoot);
    if (isDirty) {
      console.log(
        chalk.yellow('Warning: You have uncommitted changes. Consider committing first.'),
      );
    }
  }

  const shouldFixNaming = !options.rule || options.rule.includes('file-naming');
  const shouldFixTests = !options.rule || options.rule.includes('missing-test');

  // Collect source files
  const allFiles = getAllSourceFiles(projectRoot, config);

  // Compute naming renames
  const renames: RenameRecord[] = [];
  if (shouldFixNaming) {
    for (const file of allFiles) {
      const resolved = resolveConfigForFile(file, config);
      if (!resolved.rules.enforceNaming || !resolved.conventions.fileNaming) continue;

      const violation = checkNaming(file, resolved.conventions);
      if (!violation) continue;

      const convention = getConventionValue(resolved.conventions.fileNaming);
      if (!convention) continue;

      const rename = computeRename(file, convention, projectRoot);
      if (rename) renames.push(rename);
    }
  }

  const dedupedRenames = deduplicateRenames(renames);

  // Compute test stubs
  const testStubs: TestStubRecord[] = [];
  if (shouldFixTests) {
    const testViolations = checkMissingTests(projectRoot, config, 'warn');
    for (const v of testViolations) {
      const stub = generateTestStub(v.file, config, projectRoot);
      if (stub) testStubs.push(stub);
    }
  }

  // Pre-scan for aliased imports that would break after renaming
  const aliasImports = await scanForAliasImports(dedupedRenames, projectRoot);

  // Determine which renames are blocked by alias imports
  const blockedOldBareNames = new Set<string>();
  for (const alias of aliasImports) {
    const lastSegment = alias.specifier.split('/').pop() ?? '';
    const bare = lastSegment.replace(/\.(tsx?|jsx?|mjs|cjs)$/, '');
    blockedOldBareNames.add(bare);
  }

  const safeRenames = dedupedRenames.filter((r) => {
    const oldFilename = path.basename(r.oldPath);
    const bare = oldFilename.slice(0, oldFilename.indexOf('.'));
    return !blockedOldBareNames.has(bare);
  });
  const skippedRenames = dedupedRenames.filter((r) => {
    const oldFilename = path.basename(r.oldPath);
    const bare = oldFilename.slice(0, oldFilename.indexOf('.'));
    return blockedOldBareNames.has(bare);
  });

  // Nothing to fix
  if (safeRenames.length === 0 && testStubs.length === 0 && skippedRenames.length === 0) {
    console.log(`${chalk.green('✓')} No fixable violations found.`);
    return 0;
  }

  // Display plan
  printPlan(safeRenames, testStubs);

  // Show alias import warnings before confirmation
  if (skippedRenames.length > 0) {
    console.log('');
    console.log(
      chalk.yellow(
        `Skipping ${skippedRenames.length} rename${skippedRenames.length > 1 ? 's' : ''} — aliased imports would break:`,
      ),
    );
    for (const r of skippedRenames.slice(0, 5)) {
      console.log(chalk.dim(`  ${r.oldPath} → ${r.newPath}`));
    }
    if (skippedRenames.length > 5) {
      console.log(chalk.dim(`  ... and ${skippedRenames.length - 5} more`));
    }
    console.log('');
    console.log(chalk.yellow('Affected aliased imports:'));
    for (const alias of aliasImports.slice(0, 5)) {
      const relFile = path.relative(projectRoot, alias.file);
      console.log(chalk.dim(`  ${relFile}:${alias.line} — ${alias.specifier}`));
    }
    if (aliasImports.length > 5) {
      console.log(chalk.dim(`  ... and ${aliasImports.length - 5} more`));
    }
    console.log(chalk.dim('  Update these imports to relative paths first, then re-run fix.'));
  }

  if (safeRenames.length === 0 && testStubs.length === 0) {
    console.log(`\n${chalk.yellow('!')} No safe fixes to apply. Resolve aliased imports first.`);
    return 0;
  }

  if (options.dryRun) {
    console.log(chalk.dim('\nDry run — no changes applied.'));
    return 0;
  }

  // Confirm
  if (!options.yes) {
    const confirmed = await confirmDangerous('Apply these fixes?');
    if (!confirmed) {
      console.log('Aborted.');
      return 0;
    }
  }

  // Apply: 1. Renames (only safe ones — no alias import breakage)
  let renameCount = 0;
  for (const rename of safeRenames) {
    if (executeRename(rename)) {
      renameCount++;
    }
  }

  // Apply: 2. Import updates
  let importUpdateCount = 0;
  if (renameCount > 0) {
    const appliedRenames = safeRenames.filter((r) => fs.existsSync(r.newAbsPath));
    const { updates } = await updateImportsAfterRenames(appliedRenames, projectRoot);
    importUpdateCount = updates.length;
  }

  // Apply: 3. Test stubs
  let stubCount = 0;
  for (const stub of testStubs) {
    if (!fs.existsSync(stub.absPath)) {
      writeTestStub(stub, config);
      stubCount++;
    }
  }

  // Summary
  console.log('');
  if (renameCount > 0) {
    console.log(`${chalk.green('✓')} Renamed ${renameCount} file${renameCount > 1 ? 's' : ''}`);
  }
  if (importUpdateCount > 0) {
    console.log(
      `${chalk.green('✓')} Updated ${importUpdateCount} import${importUpdateCount > 1 ? 's' : ''}`,
    );
  }
  if (stubCount > 0) {
    console.log(`${chalk.green('✓')} Generated ${stubCount} test stub${stubCount > 1 ? 's' : ''}`);
  }

  return 0;
}
