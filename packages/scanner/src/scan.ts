import { stat } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import type { ScanResult } from '@viberails/types';
import {
  aggregateConventions,
  aggregateStacks,
  aggregateStatistics,
  aggregateStructures,
} from './aggregate.js';
import { detectWorkspace } from './detect-workspace.js';
import { scanPackage } from './scan-package.js';
import { readPackageJson } from './utils/read-package-json.js';

/**
 * Options for the scan function.
 */
export type ScanOptions = Record<string, never>;

/**
 * Scans a project directory and returns a comprehensive analysis of its
 * stack, structure, conventions, and statistics.
 *
 * For monorepos, each workspace package is scanned independently and
 * results are aggregated. For single-package projects, the root is
 * scanned as a single package.
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

  const workspace = await detectWorkspace(root);

  if (workspace && workspace.packages.length > 0) {
    // Read root deps for sharing with workspace packages
    const rootPkg = await readPackageJson(root);
    const rootDeps: Record<string, string> = {
      ...rootPkg?.dependencies,
      ...rootPkg?.devDependencies,
    };

    // Scan each workspace package in parallel
    const packages = await Promise.all(
      workspace.packages.map((wp) => scanPackage(wp.path, wp.name, wp.relativePath, rootDeps)),
    );

    return {
      root,
      stack: aggregateStacks(packages),
      structure: aggregateStructures(packages),
      conventions: aggregateConventions(packages),
      statistics: aggregateStatistics(packages),
      workspace,
      packages,
    };
  }

  // Single-package project
  const rootPkg = await readPackageJson(root);
  const name = rootPkg?.name ?? basename(root);
  const pkg = await scanPackage(root, name, '');

  return {
    root,
    stack: pkg.stack,
    structure: pkg.structure,
    conventions: pkg.conventions,
    statistics: pkg.statistics,
    packages: [pkg],
  };
}
