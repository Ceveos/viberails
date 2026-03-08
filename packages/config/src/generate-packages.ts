import type { ConfigConventions, ConfigStack, PackageConfig, ScanResult } from '@viberails/types';
import { CONVENTION_KEYS, formatStackItem, mapStructure } from './generate-config.js';

/**
 * Build a full ConfigStack for a single package scan result.
 */
function buildPackageStack(pkg: ScanResult['packages'][number]): ConfigStack {
  const config: ConfigStack = {
    language: formatStackItem(pkg.stack.language),
    packageManager: formatStackItem(pkg.stack.packageManager),
  };

  if (pkg.stack.framework) config.framework = formatStackItem(pkg.stack.framework);
  if (pkg.stack.styling) config.styling = formatStackItem(pkg.stack.styling);
  if (pkg.stack.backend) config.backend = formatStackItem(pkg.stack.backend);
  if (pkg.stack.orm) config.orm = formatStackItem(pkg.stack.orm);
  if (pkg.stack.linter) config.linter = formatStackItem(pkg.stack.linter);
  if (pkg.stack.formatter) config.formatter = formatStackItem(pkg.stack.formatter);
  if (pkg.stack.testRunner) config.testRunner = formatStackItem(pkg.stack.testRunner);

  return config;
}

/**
 * Build ConfigConventions as plain strings, omitting low-confidence entries.
 */
function buildPackageConventions(
  pkgConventions: Record<string, import('@viberails/types').DetectedConvention>,
): ConfigConventions {
  const config: ConfigConventions = {};

  for (const key of CONVENTION_KEYS) {
    const detected = pkgConventions[key];
    if (detected && detected.confidence !== 'low') {
      config[key] = detected.value;
    }
  }

  return config;
}

/**
 * Generate self-contained per-package configs for packages in a monorepo.
 * Each PackageConfig has its own full stack, structure, and conventions.
 *
 * Returns undefined for single-package projects.
 */
export function generatePackages(scanResult: ScanResult): PackageConfig[] | undefined {
  if (!scanResult.packages || scanResult.packages.length <= 1) return undefined;

  const packages: PackageConfig[] = [];

  for (const pkg of scanResult.packages) {
    // Build a temporary ScanResult-like object for mapStructure
    const pkgScanResult = {
      root: pkg.root,
      stack: pkg.stack,
      structure: pkg.structure,
      conventions: pkg.conventions,
      statistics: pkg.statistics,
    } as ScanResult;

    const packageConfig: PackageConfig = {
      name: pkg.name,
      path: pkg.relativePath,
      stack: buildPackageStack(pkg),
      structure: mapStructure(pkgScanResult),
      conventions: buildPackageConventions(pkg.conventions),
    };

    if (pkg.typesOnly) {
      packageConfig.rules = { testCoverage: 0 };
    }

    packages.push(packageConfig);
  }

  return packages.length > 0 ? packages : undefined;
}
