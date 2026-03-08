import type {
  ConfigConventions,
  ConfigDefaults,
  ConfigStack,
  ConfigStructure,
  ViberailsConfig,
} from '@viberails/types';
import { CONVENTION_KEYS } from './generate-config.js';

/** Stack field keys for comparison and extraction. */
export const STACK_KEYS: (keyof ConfigStack)[] = [
  'language',
  'packageManager',
  'framework',
  'styling',
  'backend',
  'orm',
  'linter',
  'formatter',
  'testRunner',
];

/** Structure field keys for comparison and extraction. */
export const STRUCTURE_KEYS: (keyof ConfigStructure)[] = [
  'srcDir',
  'pages',
  'components',
  'hooks',
  'utils',
  'types',
  'tests',
  'testPattern',
];

/**
 * Extract shared values from packages into defaults and strip them from packages.
 * Only extracts values that are identical across ALL packages.
 * Strips empty objects from packages for clean JSON output.
 */
export function compactConfig(config: ViberailsConfig): ViberailsConfig {
  const pkgs = config.packages ?? [];
  if (pkgs.length <= 1) {
    // Single package — no defaults needed
    const { defaults: _d, ...rest } = config;
    return rest;
  }

  const defaults: ConfigDefaults = {};
  const packages = pkgs.map((p) => ({ ...p }));

  // Extract shared stack fields
  const sharedStack: Partial<ConfigStack> = {};
  for (const key of STACK_KEYS) {
    const values = packages.map((p) => (p.stack ?? ({} as Partial<ConfigStack>))[key]);
    if (values[0] !== undefined && values.every((v) => v === values[0])) {
      sharedStack[key] = values[0] as string;
    }
  }
  if (Object.keys(sharedStack).length > 0) {
    defaults.stack = sharedStack;
    for (const pkg of packages) {
      const pkgStack = (pkg.stack ?? {}) as Partial<ConfigStack>;
      const sparse: Partial<ConfigStack> = {};
      for (const key of STACK_KEYS) {
        if (pkgStack[key] !== undefined && pkgStack[key] !== sharedStack[key]) {
          sparse[key] = pkgStack[key] as string;
        }
      }
      pkg.stack = sparse as ConfigStack;
    }
  }

  // Extract shared structure fields
  const sharedStructure: Partial<ConfigStructure> = {};
  for (const key of STRUCTURE_KEYS) {
    const values = packages.map((p) => p.structure?.[key]);
    const first = values[0];
    if (first !== undefined && values.every((v) => JSON.stringify(v) === JSON.stringify(first))) {
      (sharedStructure as Record<string, unknown>)[key] = first;
    }
  }
  if (Object.keys(sharedStructure).length > 0) {
    defaults.structure = sharedStructure;
    for (const pkg of packages) {
      const pkgStructure = pkg.structure ?? {};
      const sparse: Partial<ConfigStructure> = {};
      for (const key of STRUCTURE_KEYS) {
        const val = pkgStructure[key];
        if (val !== undefined && JSON.stringify(val) !== JSON.stringify(sharedStructure[key])) {
          (sparse as Record<string, unknown>)[key] = val;
        }
      }
      pkg.structure = sparse as ConfigStructure;
    }
  }

  // Extract shared conventions
  const sharedConventions: ConfigConventions = {};
  for (const key of CONVENTION_KEYS) {
    const values = packages.map((p) => p.conventions?.[key]);
    if (values[0] !== undefined && values.every((v) => v === values[0])) {
      sharedConventions[key] = values[0];
    }
  }
  if (Object.keys(sharedConventions).length > 0) {
    defaults.conventions = sharedConventions;
    for (const pkg of packages) {
      const pkgConventions = pkg.conventions ?? {};
      const sparse: ConfigConventions = {};
      for (const key of CONVENTION_KEYS) {
        if (pkgConventions[key] !== undefined && pkgConventions[key] !== sharedConventions[key]) {
          sparse[key] = pkgConventions[key];
        }
      }
      pkg.conventions = sparse;
    }
  }

  // Strip empty objects from packages
  for (const pkg of packages) {
    if (pkg.stack && Object.keys(pkg.stack).length === 0) {
      delete pkg.stack;
    }
    if (pkg.structure && Object.keys(pkg.structure).length === 0) {
      delete pkg.structure;
    }
    if (pkg.conventions && Object.keys(pkg.conventions).length === 0) {
      delete pkg.conventions;
    }
  }

  // Reconstruct with explicit key ordering so JSON output is readable:
  // $schema, version, name, rules, ignore, boundaries, defaults, packages, _meta
  const result: ViberailsConfig = {
    ...(config.$schema ? { $schema: config.$schema } : {}),
    version: config.version,
    name: config.name,
    rules: config.rules,
    ...(config.ignore && config.ignore.length > 0 ? { ignore: config.ignore } : {}),
    ...(config.boundaries ? { boundaries: config.boundaries } : {}),
    ...(Object.keys(defaults).length > 0 ? { defaults } : {}),
    packages,
    ...(config._meta ? { _meta: config._meta } : {}),
  };
  return result;
}

/**
 * Expand defaults into each package, producing fully self-contained packages.
 * Inverse of compactConfig. Ensures every package has stack, structure,
 * and conventions (even as empty objects) and config.ignore defaults to [].
 */
export function expandDefaults(config: ViberailsConfig): ViberailsConfig {
  const defaults = config.defaults;

  const packages = config.packages.map((pkg) => {
    const expanded = { ...pkg };

    // Merge defaults into package fields, or initialize to empty objects
    expanded.stack = { ...(defaults?.stack ?? {}), ...(pkg.stack ?? {}) } as ConfigStack;
    expanded.structure = { ...(defaults?.structure ?? {}), ...(pkg.structure ?? {}) };
    expanded.conventions = { ...(defaults?.conventions ?? {}), ...(pkg.conventions ?? {}) };

    return expanded;
  });

  // Ensure ignore defaults to []
  const ignore = config.ignore ?? [];

  // Return without defaults — packages are now self-contained
  const { defaults: _d, ...rest } = config;
  return { ...rest, ignore, packages };
}
