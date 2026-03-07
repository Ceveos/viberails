import { resolve } from 'node:path';
import type { PackageScanResult } from '@viberails/types';
import { computeStatistics } from './compute-statistics.js';
import { detectConventions } from './detect-conventions.js';
import { detectStack } from './detect-stack.js';
import { detectStructure } from './detect-structure.js';
import { walkDirectory } from './utils/walk-directory.js';

/**
 * Scans a single package directory and returns per-package scan results.
 *
 * Reuses all existing detector functions scoped to the package directory.
 * In monorepos, `rootDeps` provides root-level dependencies (e.g. typescript,
 * eslint) as a base layer — package-specific deps overlay on top.
 *
 * @param packagePath - Absolute path to the package directory.
 * @param name - Package name from package.json.
 * @param relativePath - Path relative to workspace root (empty string for single-package).
 * @param rootDeps - Optional root-level dependencies merged as a base layer.
 * @returns Per-package scan result.
 */
export async function scanPackage(
  packagePath: string,
  name: string,
  relativePath: string,
  rootDeps?: Record<string, string>,
): Promise<PackageScanResult> {
  const root = resolve(packagePath);
  const dirs = await walkDirectory(root, 4);

  const [stack, structure, statistics] = await Promise.all([
    detectStack(root, rootDeps),
    detectStructure(root, dirs),
    computeStatistics(root, dirs),
  ]);

  const conventions = await detectConventions(root, structure, dirs);

  return {
    name,
    root,
    relativePath,
    stack,
    structure,
    conventions,
    statistics,
  };
}
