import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadConfig } from '@viberails/config';
import type { CheckViolation, ViberailsConfig } from '@viberails/types';
import chalk from 'chalk';
import { findProjectRoot } from '../utils/find-project-root.js';
import { resolveWorkspacePackages } from '../utils/resolve-workspace-packages.js';

const CONFIG_FILE = 'viberails.config.json';

const SOURCE_EXTS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.vue',
  '.svelte',
  '.astro',
]);

const NAMING_PATTERNS: Record<string, RegExp> = {
  'kebab-case': /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/,
  camelCase: /^[a-z][a-zA-Z0-9]*$/,
  PascalCase: /^[A-Z][a-zA-Z0-9]*$/,
  snake_case: /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/,
};

export interface CheckOptions {
  files?: string[];
  staged?: boolean;
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

    if (isIgnored(relPath, config.ignore)) continue;
    if (!fs.existsSync(absPath)) continue;

    // Check 1: File size
    if (config.rules.maxFileLines > 0) {
      const lines = countFileLines(absPath);
      if (lines !== null && lines > config.rules.maxFileLines) {
        violations.push({
          file: relPath,
          rule: 'file-size',
          message: `${lines} lines (max ${config.rules.maxFileLines}). Split into focused modules.`,
          severity,
        });
      }
    }

    // Check 2: File naming convention
    if (config.rules.enforceNaming && config.conventions.fileNaming) {
      const namingViolation = checkNaming(relPath, config);
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
  if (config.rules.enforceBoundaries && config.boundaries && config.boundaries.length > 0) {
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

/** Count lines in a file. Returns null if the file can't be read. */
function countFileLines(filePath: string): number | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (content.length === 0) return 0;
    let count = 1;
    for (let i = 0; i < content.length; i++) {
      if (content.charCodeAt(i) === 10) count++;
    }
    return count;
  } catch {
    return null;
  }
}

/** Check whether a file's name violates the configured naming convention. */
function checkNaming(relPath: string, config: ViberailsConfig): string | undefined {
  const filename = path.basename(relPath);

  // Skip non-source files
  const ext = path.extname(filename);
  if (!SOURCE_EXTS.has(ext)) return undefined;

  // Skip special files
  if (
    filename.startsWith('index.') ||
    filename.includes('.config.') ||
    filename.includes('.test.') ||
    filename.includes('.spec.') ||
    filename.startsWith('.')
  ) {
    return undefined;
  }

  const bare = filename.slice(0, filename.indexOf('.'));
  const convention =
    typeof config.conventions.fileNaming === 'string'
      ? config.conventions.fileNaming
      : config.conventions.fileNaming?.value;

  if (!convention) return undefined;

  const pattern = NAMING_PATTERNS[convention];
  if (!pattern || pattern.test(bare)) return undefined;

  return `File name "${filename}" does not follow ${convention} convention.`;
}

/** Check for source files without corresponding test files. */
function checkMissingTests(
  projectRoot: string,
  config: ViberailsConfig,
  severity: 'error' | 'warn',
): CheckViolation[] {
  const violations: CheckViolation[] = [];
  const { testPattern } = config.structure;
  if (!testPattern) return violations;

  const srcDir = config.structure.srcDir;
  if (!srcDir) return violations;

  const srcPath = path.join(projectRoot, srcDir);
  if (!fs.existsSync(srcPath)) return violations;

  const testSuffix = testPattern.replace('*', '');
  const sourceFiles = collectSourceFiles(srcPath, projectRoot);

  for (const relFile of sourceFiles) {
    const basename = path.basename(relFile);

    // Skip test files, index files, type definition files
    if (
      basename.includes('.test.') ||
      basename.includes('.spec.') ||
      basename.startsWith('index.') ||
      basename.endsWith('.d.ts')
    ) {
      continue;
    }

    const ext = path.extname(basename);
    if (!SOURCE_EXTS.has(ext)) continue;

    const stem = basename.slice(0, basename.indexOf('.'));
    const expectedTestFile = `${stem}${testSuffix}`;

    // Look for the test file next to the source or in the tests directory
    const dir = path.dirname(path.join(projectRoot, relFile));
    const colocatedTest = path.join(dir, expectedTestFile);
    const testsDir = config.structure.tests;
    const dedicatedTest = testsDir ? path.join(projectRoot, testsDir, expectedTestFile) : null;

    const hasTest =
      fs.existsSync(colocatedTest) || (dedicatedTest !== null && fs.existsSync(dedicatedTest));

    if (!hasTest) {
      violations.push({
        file: relFile,
        rule: 'missing-test',
        message: `No test file found. Expected \`${expectedTestFile}\`.`,
        severity,
      });
    }
  }

  return violations;
}

/** Get staged files from git. */
function getStagedFiles(projectRoot: string): string[] {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
      cwd: projectRoot,
      encoding: 'utf-8',
    });
    return output.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

/** Get all source files in the project. */
function getAllSourceFiles(projectRoot: string, config: ViberailsConfig): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const rel = path.relative(projectRoot, path.join(dir, entry.name));
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') {
          continue;
        }
        if (isIgnored(rel, config.ignore)) continue;
        walk(path.join(dir, entry.name));
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (SOURCE_EXTS.has(ext) && !isIgnored(rel, config.ignore)) {
          files.push(rel);
        }
      }
    }
  };
  walk(projectRoot);
  return files;
}

/** Collect source files from a directory recursively. */
function collectSourceFiles(dir: string, projectRoot: string): string[] {
  const files: string[] = [];
  const walk = (d: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue;
        walk(path.join(d, entry.name));
      } else if (entry.isFile()) {
        files.push(path.relative(projectRoot, path.join(d, entry.name)));
      }
    }
  };
  walk(dir);
  return files;
}

/** Check if a path matches any ignore pattern. */
function isIgnored(relPath: string, ignorePatterns: string[]): boolean {
  for (const pattern of ignorePatterns) {
    if (pattern.endsWith('/**')) {
      const prefix = pattern.slice(0, -3);
      if (relPath.startsWith(`${prefix}/`) || relPath === prefix) return true;
    } else if (pattern.startsWith('**/')) {
      const suffix = pattern.slice(3);
      if (relPath.endsWith(suffix)) return true;
    } else if (relPath === pattern || relPath.startsWith(`${pattern}/`)) {
      return true;
    }
  }
  return false;
}
