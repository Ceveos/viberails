import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadConfig } from '@viberails/config';
import type { CheckViolation } from '@viberails/types';
import chalk from 'chalk';
import { findProjectRoot } from '../utils/find-project-root.js';
import { resolveWorkspacePackages } from '../utils/resolve-workspace-packages.js';
import { resolveConfigForFile, resolveIgnoreForFile } from './check-config.js';
import { checkCoverage } from './check-coverage.js';
import {
  checkNaming,
  countFileLines,
  getAllSourceFiles,
  getDiffDeletedTestSourceFiles,
  getDiffFiles,
  getStagedDeletedTestSourceFiles,
  getStagedFiles,
  isIgnored,
  SOURCE_EXTS,
} from './check-files.js';
import { printGroupedViolations, printSummary } from './check-print.js';
import { checkMissingTests } from './check-tests.js';

export { resolveConfigForFile } from './check-config.js';

const CONFIG_FILE = 'viberails.config.json';

export interface CheckOptions {
  files?: string[];
  staged?: boolean;
  diffBase?: string;
  noBoundaries?: boolean;
  quiet?: boolean;
  limit?: number;
  format?: 'text' | 'json';
  enforce?: boolean;
  hook?: boolean;
}

/** Check if a file path looks like a test file. */
function isTestFile(relPath: string): boolean {
  const filename = path.basename(relPath);
  return (
    filename.includes('.test.') ||
    filename.includes('.spec.') ||
    filename.startsWith('test.') ||
    filename.startsWith('spec.') ||
    relPath.includes('__tests__/') ||
    relPath.includes('__test__/')
  );
}

/**
 * Run the viberails check command.
 * Returns exit code: 0 = pass or warn-mode, 1 = violations in enforce mode.
 */
export async function checkCommand(options: CheckOptions, cwd?: string): Promise<number> {
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

  // Determine which files to check
  let filesToCheck: string[];
  let diffAddedFiles: Set<string> | null = null;
  let deletedTestSourceFiles: string[] = [];
  if (options.staged) {
    filesToCheck = getStagedFiles(projectRoot).filter((f) => SOURCE_EXTS.has(path.extname(f)));
    deletedTestSourceFiles = getStagedDeletedTestSourceFiles(projectRoot, config);
  } else if (options.diffBase) {
    const diff = getDiffFiles(projectRoot, options.diffBase);
    if (diff.error && options.enforce) {
      console.error(`${chalk.red('Error:')} ${diff.error}`);
      return 1;
    }
    filesToCheck = diff.all.filter((f) => SOURCE_EXTS.has(path.extname(f)));
    diffAddedFiles = new Set(diff.added);
    deletedTestSourceFiles = getDiffDeletedTestSourceFiles(projectRoot, options.diffBase, config);
  } else if (options.files && options.files.length > 0) {
    filesToCheck = options.files;
  } else {
    filesToCheck = getAllSourceFiles(projectRoot, config);
  }

  if (filesToCheck.length === 0 && deletedTestSourceFiles.length === 0) {
    if (options.format === 'json') {
      console.log(JSON.stringify({ violations: [], checkedFiles: 0 }));
    } else {
      console.log(`${chalk.green('✓')} No files to check.`);
    }
    return 0;
  }

  const violations: CheckViolation[] = [];
  const severity = options.enforce ? 'error' : 'warn';
  const log =
    options.format !== 'json' && !options.hook && !options.quiet
      ? (msg: string) => process.stderr.write(chalk.dim(msg))
      : () => {};

  log('  Checking files...');
  for (const file of filesToCheck) {
    const absPath = path.isAbsolute(file) ? file : path.join(projectRoot, file);
    const relPath = path.relative(projectRoot, absPath);

    const effectiveIgnore = resolveIgnoreForFile(relPath, config);
    if (isIgnored(relPath, effectiveIgnore)) continue;
    if (!fs.existsSync(absPath)) continue;

    const resolved = resolveConfigForFile(relPath, config);

    // Check 1: File size (with separate threshold for test files)
    const testFile = isTestFile(relPath);
    const maxLines = testFile ? resolved.rules.maxTestFileLines : resolved.rules.maxFileLines;
    if (maxLines > 0) {
      const lines = countFileLines(absPath);
      if (lines !== null && lines > maxLines) {
        violations.push({
          file: relPath,
          rule: 'file-size',
          message: `${lines} lines (max ${maxLines}). Split into focused modules.`,
          severity,
        });
      }
    }

    // Check 2: File naming convention
    if (resolved.rules.enforceNaming && resolved.conventions.fileNaming) {
      const namingViolation = checkNaming(relPath, resolved.conventions);
      if (namingViolation) {
        violations.push({
          file: relPath,
          rule: 'file-naming',
          message: namingViolation,
          severity,
        });
      }
    }
  }

  log(' done\n');

  // Check 3: Missing tests (scoped to staged/diff files when applicable)
  if (!options.files) {
    log('  Checking missing tests...');
    const testViolations = checkMissingTests(projectRoot, config, severity);
    if (options.staged) {
      const stagedSet = new Set(filesToCheck);
      for (const f of deletedTestSourceFiles) stagedSet.add(f);
      violations.push(...testViolations.filter((v) => stagedSet.has(v.file)));
    } else if (diffAddedFiles) {
      const checkSet = new Set(diffAddedFiles);
      for (const f of deletedTestSourceFiles) checkSet.add(f);
      violations.push(...testViolations.filter((v) => checkSet.has(v.file)));
    } else {
      violations.push(...testViolations);
    }
    log(' done\n');
  }

  // Check 4: Test coverage threshold (full check only, skip in diff mode)
  if (!options.files && !options.staged && !options.diffBase) {
    log('  Running test coverage...\n');
    const coverageViolations = checkCoverage(projectRoot, config, filesToCheck, {
      staged: options.staged,
      enforce: options.enforce,
      onProgress: (pkg) => log(`    Coverage: ${pkg}...\n`),
    });
    violations.push(...coverageViolations);
  }

  // Check 5: Boundary violations
  if (
    config.rules.enforceBoundaries &&
    config.boundaries &&
    Object.keys(config.boundaries.deny).length > 0 &&
    !options.noBoundaries
  ) {
    const startTime = Date.now();
    const { buildImportGraph, checkBoundaries } = await import('@viberails/graph');

    const packages =
      config.packages.length > 1
        ? resolveWorkspacePackages(projectRoot, config.packages)
        : undefined;

    const graph = await buildImportGraph(projectRoot, {
      packages,
      ignore: config.ignore,
    });

    const boundaryViolations = checkBoundaries(graph, config.boundaries);

    // In staged/files/diff mode, only report violations in those files
    const filterSet =
      options.staged || options.files || options.diffBase
        ? new Set(filesToCheck.map((f) => path.resolve(projectRoot, f)))
        : null;

    for (const bv of boundaryViolations) {
      if (filterSet && !filterSet.has(bv.file)) continue;

      const relFile = path.relative(projectRoot, bv.file);
      violations.push({
        file: relFile,
        rule: 'boundary-violation',
        message: `Imports "${bv.specifier}" violating boundary: ${bv.rule.from} → ${bv.rule.to}`,
        severity,
      });
    }

    log(`  Boundary check: ${graph.nodes.length} files in ${Date.now() - startTime}ms\n`);
  }

  // Output results
  if (options.format === 'json') {
    console.log(
      JSON.stringify({
        violations,
        checkedFiles: filesToCheck.length,
      }),
    );
    return options.enforce && violations.length > 0 ? 1 : 0;
  }

  if (violations.length === 0) {
    console.log(`${chalk.green('✓')} ${filesToCheck.length} files checked — no violations`);
    return 0;
  }

  if (!options.quiet) {
    printGroupedViolations(violations, options.limit);
  }

  printSummary(violations);

  if (options.enforce) {
    console.log(chalk.red('Fix violations before committing.'));
    return 1;
  }

  return 0;
}
