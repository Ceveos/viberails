import { readPackageJson } from './utils/read-package-json.js';

/**
 * Detect whether a package is types-only (no runtime code to test).
 *
 * A package is considered types-only when it has no runtime `dependencies`
 * in package.json AND its name contains "types" as a path segment
 * (e.g. `@viberails/types`, `shared-types`).
 *
 * @param packagePath - Absolute path to the package directory
 * @param name - Package name from package.json
 * @returns true if the package appears to be types-only
 */
export async function detectTypesOnly(packagePath: string, name: string): Promise<boolean> {
  const pkg = await readPackageJson(packagePath);
  if (!pkg) return false;

  const deps = pkg.dependencies;
  const hasRuntimeDeps = deps !== undefined && Object.keys(deps).length > 0;
  if (hasRuntimeDeps) return false;

  // Check if name contains "types" as a segment (split on / and -)
  const segments = name.replace(/^@[^/]+\//, '').split(/[-/]/);
  return segments.some((s) => s === 'types');
}
