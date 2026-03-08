import type { ConfigConventions, ConfigRules, ViberailsConfig } from '@viberails/types';
import { BUILTIN_IGNORE } from '@viberails/config';

export interface ResolvedConfig {
  rules: ConfigRules;
  conventions: ConfigConventions;
}

/**
 * Resolve the effective config for a file by finding its package.
 * Returns the global rules merged with any matching package overrides.
 */
export function resolveConfigForFile(relPath: string, config: ViberailsConfig): ResolvedConfig {
  // Sort by path length descending to match the most specific package first
  const sortedPackages = [...config.packages].sort((a, b) => b.path.length - a.path.length);

  for (const pkg of sortedPackages) {
    if (pkg.path === '.') continue; // Check non-root packages first
    if (relPath.startsWith(`${pkg.path}/`) || relPath === pkg.path) {
      return {
        rules: { ...config.rules, ...pkg.rules },
        conventions: pkg.conventions ?? {},
      };
    }
  }

  // Fall back to root package
  const root = config.packages.find((p) => p.path === '.') ?? config.packages[0];
  return {
    rules: { ...config.rules, ...root.rules },
    conventions: root.conventions ?? {},
  };
}

/**
 * Get effective ignore patterns: BUILTIN_IGNORE + config.ignore + package-specific.
 */
export function getEffectiveIgnore(config: ViberailsConfig): string[] {
  return [...BUILTIN_IGNORE, ...(config.ignore ?? [])];
}

/**
 * Resolve ignore patterns for a file, appending any package-specific patterns.
 */
export function resolveIgnoreForFile(relPath: string, config: ViberailsConfig): string[] {
  const base = getEffectiveIgnore(config);

  for (const pkg of config.packages) {
    if (pkg.ignore && (relPath.startsWith(`${pkg.path}/`) || pkg.path === '.')) {
      return [...base, ...pkg.ignore];
    }
  }
  return base;
}
