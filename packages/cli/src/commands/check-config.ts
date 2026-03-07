import type { ConfigConventions, ConfigRules, ViberailsConfig } from '@viberails/types';

export interface ResolvedConfig {
  rules: ConfigRules;
  conventions: ConfigConventions;
}

/**
 * Resolve the effective config for a file by finding its package override.
 * Returns the global config merged with any matching package overrides.
 */
export function resolveConfigForFile(relPath: string, config: ViberailsConfig): ResolvedConfig {
  if (!config.packages || config.packages.length === 0) {
    return { rules: config.rules, conventions: config.conventions };
  }

  // Sort by path length descending to match the most specific package first
  const sortedPackages = [...config.packages].sort((a, b) => b.path.length - a.path.length);

  for (const pkg of sortedPackages) {
    if (relPath.startsWith(`${pkg.path}/`) || relPath === pkg.path) {
      return {
        rules: { ...config.rules, ...pkg.rules },
        conventions: { ...config.conventions, ...pkg.conventions },
      };
    }
  }

  return { rules: config.rules, conventions: config.conventions };
}

/**
 * Resolve ignore patterns for a file, appending any package-specific patterns.
 */
export function resolveIgnoreForFile(relPath: string, config: ViberailsConfig): string[] {
  const globalIgnore = config.ignore;
  if (!config.packages) return globalIgnore;

  for (const pkg of config.packages) {
    if (pkg.ignore && relPath.startsWith(`${pkg.path}/`)) {
      return [...globalIgnore, ...pkg.ignore];
    }
  }
  return globalIgnore;
}
