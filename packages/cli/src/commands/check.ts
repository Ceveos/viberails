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

    // Check 1: File size
    if (resolved.rules.maxFileLines > 0) {
      const lines = countFileLines(absPath);
      if (lines !== null && lines > resolved.rules.maxFileLines) {
        violations.push({
          file: relPath,
          rule: 'file-size',
          message: `${lines} lines (max ${resolved.rules.maxFileLines}). Split into focused modules.`,
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
    config.boundaries.length > 0 &&
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
        message: `Imports "${bv.specifier}" violating boundary: ${bv.rule.from} → ${bv.rule.to}${bv.rule.reason ? ` (${bv.rule.reason})` : ''}`,
        severity,
      });
    }

    const elapsed = Date.now() - startTime;
    console.log(chalk.dim(`  Boundary check: ${graph.nodes.length} files in ${elapsed}ms`));
  }

  // Output results
  if (violations.length === 0) {
    console.log(`${chalk.green('✓')} ${filesToCheck.length} files checked — no violations`);
    return 0;
  }

  for (const v of violations) {
    const icon = v.severity === 'error' ? chalk.red('✗') : chalk.yellow('!');
    console.log(`${icon} ${chalk.dim(v.rule)} ${v.file}: ${v.message}`);
  }

  const word = violations.length === 1 ? 'violation' : 'violations';
  console.log(`\n${violations.length} ${word} found.`);

  if (config.enforcement === 'enforce') {
    console.log(chalk.red('Fix violations before committing.'));
    return 1;
  }

  return 0;
}
