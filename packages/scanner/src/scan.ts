import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { ScanResult } from '@viberails/types';
import { computeStatistics } from './compute-statistics.js';
import { detectConventions } from './detect-conventions.js';
import { detectStack } from './detect-stack.js';
import { detectStructure } from './detect-structure.js';
import { detectWorkspace } from './detect-workspace.js';
import type { WalkedDirectory } from './utils/walk-directory.js';
import { walkDirectory } from './utils/walk-directory.js';

/**
 * Options for the scan function.
 */
export type ScanOptions = {};

/** Patterns that indicate a directory is inside test fixtures, not real project code. */
const FIXTURE_PATTERNS = [
  /^tests\/fixtures(\/|$)/,
  /^test\/fixtures(\/|$)/,
  /^__tests__\/fixtures(\/|$)/,
  /^fixtures(\/|$)/,
];

/**
 * Filters out directories that are inside test fixture directories.
 * Fixture directories contain sample project structures that should not
 * be analyzed as part of the real project.
 */
function filterFixtureDirs(dirs: WalkedDirectory[]): WalkedDirectory[] {
  return dirs.filter((d) => !FIXTURE_PATTERNS.some((pattern) => pattern.test(d.relativePath)));
}

/**
 * Scans a project directory and returns a comprehensive analysis of its
 * stack, structure, conventions, and statistics.
 *
 * This is the primary entry point for the scanner package. It composes
 * all individual detection functions into a unified ScanResult.
 *
 * @param projectPath - Absolute or relative path to the project root.
 * @param options - Optional scan configuration.
 * @returns Complete scan result for the project.
 * @throws If the project path does not exist or is not a directory.
 */
export async function scan(projectPath: string, _options?: ScanOptions): Promise<ScanResult> {
  const root = resolve(projectPath);

  // Validate that the path exists and is a directory
  try {
    const st = await stat(root);
    if (!st.isDirectory()) {
      throw new Error(`Project path is not a directory: ${root}`);
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Project path is not')) {
      throw err;
    }
    throw new Error(`Project path does not exist: ${root}`);
  }

  // Walk directory tree once and share with all detectors
  const allDirs = await walkDirectory(root, 4);
  const dirs = filterFixtureDirs(allDirs);

  // Detect workspace first — needed for aggregating deps in stack detection
  const workspace = await detectWorkspace(root);
  const workspaceDirs = workspace?.packages.map((p) => p.path);

  // Run independent detectors in parallel, passing shared walk result
  const [stack, structure, statistics] = await Promise.all([
    detectStack(root, workspaceDirs),
    detectStructure(root, dirs),
    computeStatistics(root, dirs),
  ]);

  // detectConventions depends on structure result
  const conventions = await detectConventions(root, structure, dirs);

  return {
    root,
    stack,
    structure,
    conventions,
    statistics,
    workspace,
  };
}
