import type {
  ConfigConventions,
  ConfigStack,
  DetectedConvention,
  PackageConfigOverrides,
  ScanResult,
  ViberailsConfig,
} from '@viberails/types';
import { CONVENTION_KEYS, formatStackItem, mapConvention } from './generate-config.js';

/**
 * Compare a package's conventions against the global config conventions.
 * Returns only the differing conventions, or undefined if all match.
 */
export function conventionsDiffer(
  pkgConventions: Record<string, DetectedConvention>,
  globalConventions: ConfigConventions,
): Partial<ConfigConventions> | undefined {
  const overrides: Partial<ConfigConventions> = {};
  let hasDiff = false;

  for (const key of CONVENTION_KEYS) {
    const detected = pkgConventions[key];
    if (!detected) continue;

    const mapped = mapConvention(detected);
    if (mapped === undefined) continue;

    const globalValue = globalConventions[key];
    const globalStr = typeof globalValue === 'string' ? globalValue : globalValue?.value;
    if (detected.value !== globalStr) {
      overrides[key] = mapped;
      hasDiff = true;
    }
  }

  return hasDiff ? overrides : undefined;
}

/**
 * Generate per-package config overrides for packages whose stack or
 * conventions differ from the aggregate global config.
 */
export function generatePackageOverrides(
  scanResult: ScanResult,
  globalConfig: ViberailsConfig,
): PackageConfigOverrides[] | undefined {
  if (!scanResult.packages || scanResult.packages.length <= 1) return undefined;

  const overrides: PackageConfigOverrides[] = [];

  for (const pkg of scanResult.packages) {
    const override: PackageConfigOverrides = {
      name: pkg.name,
      path: pkg.relativePath,
    };
    let hasDiff = false;

    // Compare stack fields — only include overrides when the package has a
    // value that differs from the global, not when the package simply lacks the field
    const stackOverride: Partial<ConfigStack> = {};
    let hasStackDiff = false;

    const optionalStackFields = [
      'framework',
      'styling',
      'backend',
      'orm',
      'linter',
      'formatter',
      'testRunner',
    ] as const;
    for (const field of optionalStackFields) {
      const pkgItem = pkg.stack[field];
      if (!pkgItem) continue;
      const pkgValue = formatStackItem(pkgItem);
      if (pkgValue !== globalConfig.stack[field]) {
        stackOverride[field] = pkgValue;
        hasStackDiff = true;
      }
    }

    if (hasStackDiff) {
      override.stack = stackOverride;
      hasDiff = true;
    }

    // Compare conventions
    const conventionOverrides = conventionsDiffer(pkg.conventions, globalConfig.conventions);
    if (conventionOverrides) {
      override.conventions = conventionOverrides;
      hasDiff = true;
    }

    if (hasDiff) {
      overrides.push(override);
    }
  }

  return overrides.length > 0 ? overrides : undefined;
}
