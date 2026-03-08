import type {
  ConfigConventions,
  ConfigStack,
  ConfigStructure,
  ConventionMeta,
  PackageConfig,
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
    orm: existing.orm ?? fresh.orm,
    linter: existing.linter ?? fresh.linter,
    formatter: existing.formatter ?? fresh.formatter,
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
 * Merge conventions: keep all existing values, add new ones from fresh scan.
 * New conventions are marked with `detected: true` in _meta.
 */
function mergeConventions(
  existing: ConfigConventions,
  fresh: ConfigConventions,
  existingMeta: Record<string, ConventionMeta> | undefined,
  freshMeta: Record<string, ConventionMeta> | undefined,
): { conventions: ConfigConventions; meta: Record<string, ConventionMeta> } {
  const conventions: ConfigConventions = { ...existing };
  const meta: Record<string, ConventionMeta> = { ...(existingMeta ?? {}) };

  for (const key of CONVENTION_KEYS) {
    if (existing[key] === undefined && fresh[key] !== undefined) {
      conventions[key] = fresh[key];
      // Mark as newly detected in meta
      if (freshMeta?.[key]) {
        meta[key] = { ...freshMeta[key], detected: true };
      }
    } else if (existing[key] !== undefined && freshMeta?.[key]) {
      // Update meta with latest scan data but preserve existing convention value
      meta[key] = { ...freshMeta[key], value: freshMeta[key].value };
    }
  }

  return { conventions, meta };
}

/**
 * Merge a single package config, preserving existing values and adding fresh detections.
 */
function mergePackage(
  existing: PackageConfig,
  fresh: PackageConfig,
  existingMeta: Record<string, ConventionMeta> | undefined,
  freshMeta: Record<string, ConventionMeta> | undefined,
): { pkg: PackageConfig; meta: Record<string, ConventionMeta> } {
  const { conventions, meta } = mergeConventions(
    existing.conventions ?? {},
    fresh.conventions ?? {},
    existingMeta,
    freshMeta,
  );

  return {
    pkg: {
      ...existing,
      stack: mergeStack(existing.stack ?? ({} as ConfigStack), fresh.stack ?? ({} as ConfigStack)),
      structure: mergeStructure(existing.structure ?? {}, fresh.structure ?? {}),
      conventions,
    },
    meta,
  };
}

/**
 * Merge a new scan result into an existing config for `viberails sync`.
 *
 * Preserves all developer-confirmed values from the existing config.
 * Adds newly detected values. New conventions are marked with
 * `detected: true` in _meta so the developer can review them.
 *
 * @param existing - The current ViberailsConfig (from viberails.config.json)
 * @param scanResult - Fresh scan results from re-scanning the project
 * @returns A merged config that preserves existing values and adds new detections
 */
export function mergeConfig(existing: ViberailsConfig, scanResult: ScanResult): ViberailsConfig {
  const fresh = generateConfig(scanResult);

  const existingByPath = new Map(existing.packages.map((p) => [p.path, p]));
  const freshByPath = new Map(fresh.packages.map((p) => [p.path, p]));

  const mergedPackages: PackageConfig[] = [];
  const mergedPkgMeta: Record<string, { conventions?: Record<string, ConventionMeta> }> = {};

  // Merge existing packages with fresh data
  for (const existingPkg of existing.packages) {
    const freshPkg = freshByPath.get(existingPkg.path);
    if (freshPkg) {
      const existingConvMeta = existing._meta?.packages?.[existingPkg.path]?.conventions;
      const freshConvMeta = fresh._meta?.packages?.[existingPkg.path]?.conventions;
      const { pkg, meta } = mergePackage(existingPkg, freshPkg, existingConvMeta, freshConvMeta);
      mergedPackages.push(pkg);
      if (Object.keys(meta).length > 0) {
        mergedPkgMeta[pkg.path] = { conventions: meta };
      }
    } else {
      mergedPackages.push(existingPkg);
    }
  }

  // Add new packages from fresh scan
  for (const freshPkg of fresh.packages) {
    if (!existingByPath.has(freshPkg.path)) {
      mergedPackages.push(freshPkg);
      const freshConvMeta = fresh._meta?.packages?.[freshPkg.path]?.conventions;
      if (freshConvMeta && Object.keys(freshConvMeta).length > 0) {
        mergedPkgMeta[freshPkg.path] = { conventions: freshConvMeta };
      }
    }
  }

  const merged: ViberailsConfig = {
    $schema: existing.$schema ?? fresh.$schema,
    version: existing.version,
    name: existing.name,
    rules: { ...existing.rules },
    ignore: [...(existing.ignore ?? [])],
    packages: mergedPackages,
    _meta: {
      lastSync: new Date().toISOString(),
      ...(Object.keys(mergedPkgMeta).length > 0 ? { packages: mergedPkgMeta } : {}),
    },
  };

  // Boundaries: preserve existing rules (user may have adjusted)
  if (existing.boundaries) {
    merged.boundaries = {
      deny: { ...existing.boundaries.deny },
      ...(existing.boundaries.ignore ? { ignore: [...existing.boundaries.ignore] } : {}),
    };
  } else if (fresh.boundaries) {
    merged.boundaries = {
      deny: { ...fresh.boundaries.deny },
      ...(fresh.boundaries.ignore ? { ignore: [...fresh.boundaries.ignore] } : {}),
    };
  }

  return merged;
}
