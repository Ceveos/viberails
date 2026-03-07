import type {
  ConfigConventions,
  ConfigStack,
  ConfigStructure,
  ConventionValue,
  PackageConfigOverrides,
  ScanResult,
  ViberailsConfig,
} from '@viberails/types';
import { CONVENTION_KEYS, generateConfig } from './generate-config.js';

/**
 * Merge stack: keep existing values, fill in undefined fields from fresh scan.
 */
function mergeStack(existing: ConfigStack, fresh: ConfigStack): ConfigStack {
  return {
    language: existing.language,
    packageManager: existing.packageManager,
    framework: existing.framework ?? fresh.framework,
    styling: existing.styling ?? fresh.styling,
    backend: existing.backend ?? fresh.backend,
    linter: existing.linter ?? fresh.linter,
    testRunner: existing.testRunner ?? fresh.testRunner,
  };
}

/**
 * Merge structure: keep existing values, fill in undefined fields from fresh scan.
 */
function mergeStructure(existing: ConfigStructure, fresh: ConfigStructure): ConfigStructure {
  return {
    srcDir: existing.srcDir ?? fresh.srcDir,
    pages: existing.pages ?? fresh.pages,
    components: existing.components ?? fresh.components,
    hooks: existing.hooks ?? fresh.hooks,
    utils: existing.utils ?? fresh.utils,
    types: existing.types ?? fresh.types,
    tests: existing.tests ?? fresh.tests,
    testPattern: existing.testPattern ?? fresh.testPattern,
  };
}

/**
 * Check if a convention key exists in the existing config
 * (either as a string or as an object with a value).
 */
function hasConvention(conventions: ConfigConventions, key: keyof ConfigConventions): boolean {
  return conventions[key] !== undefined;
}

/**
 * Mark a ConventionValue as newly detected by adding `_detected: true`.
 * Only applies to object-form values (not plain strings).
 */
function markAsDetected(value: ConventionValue): ConventionValue {
  if (typeof value === 'string') {
    return { value, _confidence: 'high', _consistency: 100, _detected: true };
  }
  return { ...value, _detected: true };
}

/**
 * Merge conventions: keep all existing values, add new detections with `_detected: true`.
 */
function mergeConventions(
  existing: ConfigConventions,
  fresh: ConfigConventions,
): ConfigConventions {
  const merged: ConfigConventions = { ...existing };

  for (const key of CONVENTION_KEYS) {
    if (!hasConvention(existing, key) && fresh[key] !== undefined) {
      merged[key] = markAsDetected(fresh[key]!);
    }
  }

  return merged;
}

/**
 * Merge a new scan result into an existing config for `viberails sync`.
 *
 * Preserves all developer-confirmed values from the existing config.
 * Adds newly detected conventions with a `_detected: true` annotation
 * so the developer can review them. Never removes rules or values
 * the developer has set.
 *
 * @param existing - The current ViberailsConfig (from viberails.config.json)
 * @param scanResult - Fresh scan results from re-scanning the project
 * @returns A merged config that preserves existing values and adds new detections
 */
export function mergeConfig(existing: ViberailsConfig, scanResult: ScanResult): ViberailsConfig {
  const fresh = generateConfig(scanResult);

  const merged: ViberailsConfig = {
    $schema: existing.$schema ?? fresh.$schema,
    version: existing.version,
    name: existing.name,
    enforcement: existing.enforcement,
    stack: mergeStack(existing.stack, fresh.stack),
    structure: mergeStructure(existing.structure, fresh.structure),
    conventions: mergeConventions(existing.conventions, fresh.conventions),
    rules: { ...existing.rules },
    ignore: [...existing.ignore],
  };

  // Workspace: always take fresh scan (structure can change)
  if (fresh.workspace) {
    merged.workspace = fresh.workspace;
  }

  // Boundaries: preserve existing rules (user may have adjusted)
  if (existing.boundaries) {
    merged.boundaries = [...existing.boundaries];
  } else if (fresh.boundaries) {
    merged.boundaries = [...fresh.boundaries];
  }

  // Packages: preserve existing overrides, add new ones
  if (existing.packages || fresh.packages) {
    merged.packages = mergePackageOverrides(existing.packages, fresh.packages);
  }

  return merged;
}

/**
 * Merge per-package overrides: keep existing user-edited overrides,
 * add new packages from fresh scan.
 */
function mergePackageOverrides(
  existing?: PackageConfigOverrides[],
  fresh?: PackageConfigOverrides[],
): PackageConfigOverrides[] | undefined {
  if (!fresh || fresh.length === 0) return existing;
  if (!existing || existing.length === 0) return fresh;

  const existingByPath = new Map(existing.map((p) => [p.path, p]));
  const merged: PackageConfigOverrides[] = [...existing];

  for (const freshPkg of fresh) {
    if (!existingByPath.has(freshPkg.path)) {
      merged.push(freshPkg);
    }
  }

  return merged.length > 0 ? merged : undefined;
}
