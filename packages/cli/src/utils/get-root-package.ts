import type { PackageConfig } from '@viberails/types';

/**
 * Find the root package (path === '.') from a packages array.
 * Falls back to the first package if no root is found.
 */
export function getRootPackage(packages: PackageConfig[]): PackageConfig {
  return packages.find((pkg) => pkg.path === '.') ?? packages[0];
}
