import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadConfig } from '@viberails/config';
import type { CheckViolation } from '@viberails/types';
import chalk from 'chalk';
import { findProjectRoot } from '../utils/find-project-root.js';
import { resolveWorkspacePackages } from '../utils/resolve-workspace-packages.js';
import { resolveConfigForFile, resolveIgnoreForFile } from './check-config.js';
import {
  checkNaming,
  countFileLines,
  getAllSourceFiles,
  getStagedFiles,
  isIgnored,
} from './check-files.js';
import { checkMissingTests } from './check-tests.js';

export { resolveConfigForFile } from './check-config.js';

const CONFIG_FILE = 'viberails.config.json';

export interface CheckOptions {
  files?: string[];
  staged?: boolean;
  noBoundaries?: boolean;
  quiet?: boolean;
  limit?: number;
  format?: 'text' | 'json';
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
 * Print violations grouped by rule type with counts.
 */
function printGroupedViolations(violations: CheckViolation[], limit?: number): void {
  const groups = new Map<string, CheckViolation[]>();
  for (const v of violations) {
    const existing = groups.get(v.rule) ?? [];
    existing.push(v);
    groups.set(v.rule, existing);
  }

  const ruleOrder = ['file-size', 'file-naming', 'missing-test', 'boundary-violation'];
  const sortedKeys = [...groups.keys()].sort(
    (a, b) =>
      (ruleOrder.indexOf(a) === -1 ? 99 : ruleOrder.indexOf(a)) -
      (ruleOrder.indexOf(b) === -1 ? 99 : ruleOrder.indexOf(b)),
  );

  let totalShown = 0;
  const totalLimit = limit ?? Number.POSITIVE_INFINITY;

  for (const rule of sortedKeys) {
    const group = groups.get(rule);
    if (!group) continue;
    const remaining = totalLimit - totalShown;
    if (remaining <= 0) break;

    const toShow = group.slice(0, remaining);
    const hidden = group.length - toShow.length;

    for (const v of toShow) {
      const icon = v.severity === 'error' ? chalk.red('✗') : chalk.yellow('!');
      console.log(`${icon} ${chalk.dim(v.rule)} ${v.file}: ${v.message}`);
    }
    totalShown += toShow.length;

    if (hidden > 0) {
      console.log(chalk.dim(`  ... and ${hidden} more ${rule} violations`));
    }
  }
}

/**
 * Print a summary of violations by rule type.
 */
function printSummary(violations: CheckViolation[]): void {
  const counts = new Map<string, number>();
  for (const v of violations) {
    counts.set(v.rule, (counts.get(v.rule) ?? 0) + 1);
  }

  const word = violations.length === 1 ? 'violation' : 'violations';
  const parts = [...counts.entries()].map(([rule, count]) => `${count} ${rule}`);
  console.log(`\n${violations.length} ${word} found (${parts.join(', ')}).`);
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
  if (options.staged) {
    filesToCheck = getStagedFiles(projectRoot);
  } else if (options.files && options.files.length > 0) {
    filesToCheck = options.files;
  } else {
    filesToCheck = getAllSourceFiles(projectRoot, config);
  }

  if (filesToCheck.length === 0) {
    console.log(`${chalk.green('✓')} No files to check.`);
    return 0;
  }

  const violations: CheckViolation[] = [];
  const severity = config.enforcement === 'enforce' ? 'error' : 'warn';

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

  // Check 3: Missing tests (only on full project check, not staged/specific files)
  if (config.rules.requireTests && !options.staged && !options.files) {
    const testViolations = checkMissingTests(projectRoot, config, severity);
    violations.push(...testViolations);
  }

  // Check 4: Boundary violations
  if (
    config.rules.enforceBoundaries &&
    config.boundaries &&
    Object.keys(config.boundaries.deny).length > 0 &&
    !options.noBoundaries
  ) {
    const startTime = Date.now();
    const { buildImportGraph, checkBoundaries } = await import('@viberails/graph');

    const packages = config.workspace
      ? resolveWorkspacePackages(projectRoot, config.workspace)
      : undefined;

    const graph = await buildImportGraph(projectRoot, {
      packages,
      ignore: config.ignore,
    });

    const boundaryViolations = checkBoundaries(graph, config.boundaries);

    // In staged/files mode, only report violations in those files
    const filterSet =
      options.staged || options.files
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

    const elapsed = Date.now() - startTime;
    console.log(chalk.dim(`  Boundary check: ${graph.nodes.length} files in ${elapsed}ms`));
  }

  // Output results
  if (options.format === 'json') {
    console.log(
      JSON.stringify({
        violations,
        checkedFiles: filesToCheck.length,
        enforcement: config.enforcement,
      }),
    );
    return config.enforcement === 'enforce' && violations.length > 0 ? 1 : 0;
  }

  if (violations.length === 0) {
    console.log(`${chalk.green('✓')} ${filesToCheck.length} files checked — no violations`);
    return 0;
  }

  if (!options.quiet) {
    printGroupedViolations(violations, options.limit);
  }

  printSummary(violations);

  if (config.enforcement === 'enforce') {
    console.log(chalk.red('Fix violations before committing.'));
    return 1;
  }

  return 0;
}
