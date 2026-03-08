import type {
  CodebaseStatistics,
  ConfigConventions,
  ConfigStack,
  ConfigStructure,
  PackageConfig,
  ViberailsConfig,
} from '@viberails/types';
import { CONVENTION_LABELS, FRAMEWORK_NAMES, ORM_NAMES, STYLING_NAMES } from '@viberails/types';

export interface ConfigChange {
  type: 'added' | 'changed' | 'removed';
  description: string;
}

/**
 * Parse a stack string like "nextjs@15" into { name: "nextjs", version: "15" }.
 */
function parseStackString(s: string): { name: string; version?: string } {
  const atIdx = s.indexOf('@');
  if (atIdx > 0) {
    return { name: s.slice(0, atIdx), version: s.slice(atIdx + 1) };
  }
  return { name: s };
}

/**
 * Resolve a stack string to a human-readable display name.
 */
function displayStackName(s: string): string {
  const { name, version } = parseStackString(s);
  const allMaps: Record<string, string> = {
    ...FRAMEWORK_NAMES,
    ...STYLING_NAMES,
    ...ORM_NAMES,
  };
  const display = allMaps[name] ?? name;
  return version ? `${display} ${version}` : display;
}

/**
 * Check if a convention was newly detected during sync (via _meta).
 */
function isNewlyDetected(config: ViberailsConfig, pkgPath: string, key: string): boolean {
  return config._meta?.packages?.[pkgPath]?.conventions?.[key]?.detected === true;
}

/** Stack fields to compare (excluding language and packageManager which rarely change). */
const STACK_FIELDS: (keyof ConfigStack)[] = [
  'framework',
  'styling',
  'backend',
  'orm',
  'linter',
  'formatter',
  'testRunner',
];

/** Convention keys to compare. */
const CONVENTION_KEYS: (keyof ConfigConventions)[] = [
  'fileNaming',
  'componentNaming',
  'hookNaming',
  'importAlias',
];

/** Structure fields to compare. */
const STRUCTURE_FIELDS: { key: keyof ConfigStructure; label: string }[] = [
  { key: 'srcDir', label: 'source directory' },
  { key: 'pages', label: 'pages directory' },
  { key: 'components', label: 'components directory' },
  { key: 'hooks', label: 'hooks directory' },
  { key: 'utils', label: 'utilities directory' },
  { key: 'types', label: 'types directory' },
  { key: 'tests', label: 'tests directory' },
  { key: 'testPattern', label: 'test pattern' },
];

/**
 * Diff a single package between existing and merged configs.
 */
function diffPackage(
  existing: PackageConfig,
  merged: PackageConfig,
  mergedConfig: ViberailsConfig,
): ConfigChange[] {
  const changes: ConfigChange[] = [];
  const pkgPrefix = existing.path === '.' ? '' : `${existing.path}: `;

  // Stack changes
  for (const field of STACK_FIELDS) {
    const oldVal = existing.stack?.[field];
    const newVal = merged.stack?.[field];

    if (!oldVal && newVal) {
      changes.push({
        type: 'added',
        description: `${pkgPrefix}Stack: added ${displayStackName(newVal)}`,
      });
    } else if (oldVal && newVal && oldVal !== newVal) {
      changes.push({
        type: 'changed',
        description: `${pkgPrefix}Stack: ${displayStackName(oldVal)} → ${displayStackName(newVal)}`,
      });
    }
  }

  // Convention changes
  for (const key of CONVENTION_KEYS) {
    const oldVal = existing.conventions?.[key];
    const newVal = merged.conventions?.[key];
    const label = CONVENTION_LABELS[key] ?? key;

    if (!oldVal && newVal) {
      changes.push({
        type: 'added',
        description: `${pkgPrefix}New convention: ${label} (${newVal})`,
      });
    } else if (oldVal && newVal && oldVal !== newVal) {
      const suffix = isNewlyDetected(mergedConfig, merged.path, key) ? ' (newly detected)' : '';
      changes.push({
        type: 'changed',
        description: `${pkgPrefix}Convention updated: ${label} (${newVal})${suffix}`,
      });
    }
  }

  // Structure changes
  for (const { key, label } of STRUCTURE_FIELDS) {
    const oldVal = existing.structure?.[key];
    const newVal = merged.structure?.[key];

    if (!oldVal && newVal) {
      changes.push({
        type: 'added',
        description: `${pkgPrefix}Structure: detected ${label} (${newVal})`,
      });
    }
  }

  return changes;
}

/**
 * Compare two ViberailsConfig objects and return a list of human-readable changes.
 *
 * @param existing - The config before sync
 * @param merged - The config after merging with fresh scan results
 * @returns Array of changes, empty if configs are identical
 */
export function diffConfigs(existing: ViberailsConfig, merged: ViberailsConfig): ConfigChange[] {
  const changes: ConfigChange[] = [];

  // Build lookup maps by path
  const existingByPath = new Map(existing.packages.map((p) => [p.path, p]));
  const mergedByPath = new Map(merged.packages.map((p) => [p.path, p]));

  // Diff existing packages against merged
  for (const existingPkg of existing.packages) {
    const mergedPkg = mergedByPath.get(existingPkg.path);
    if (mergedPkg) {
      changes.push(...diffPackage(existingPkg, mergedPkg, merged));
    }
  }

  // New packages
  for (const mergedPkg of merged.packages) {
    if (!existingByPath.has(mergedPkg.path)) {
      changes.push({ type: 'added', description: `New package: ${mergedPkg.path}` });
    }
  }

  return changes;
}

/**
 * Format a stats delta as a human-readable string.
 */
export function formatStatsDelta(
  oldStats: CodebaseStatistics,
  newStats: CodebaseStatistics,
): string | undefined {
  const fileDelta = newStats.totalFiles - oldStats.totalFiles;
  const lineDelta = newStats.totalLines - oldStats.totalLines;

  if (fileDelta === 0 && lineDelta === 0) return undefined;

  const parts: string[] = [];

  if (fileDelta !== 0) {
    const sign = fileDelta > 0 ? '+' : '';
    parts.push(`${sign}${fileDelta.toLocaleString()} files`);
  }

  if (lineDelta !== 0) {
    const sign = lineDelta > 0 ? '+' : '';
    parts.push(`${sign}${lineDelta.toLocaleString()} lines`);
  }

  return `${parts.join(', ')} since last sync`;
}
