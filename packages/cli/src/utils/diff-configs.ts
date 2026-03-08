import type {
  CodebaseStatistics,
  ConfigConventions,
  ConfigStack,
  ConfigStructure,
  ConventionValue,
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
 * e.g. "tailwindcss@4" → "Tailwind CSS 4", "typescript" → "typescript"
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
 * Extract the string value from a ConventionValue.
 */
function conventionStr(cv: ConventionValue): string {
  return typeof cv === 'string' ? cv : cv.value;
}

/**
 * Check if a convention value was newly detected during sync.
 */
function isDetected(cv: ConventionValue): boolean {
  return typeof cv !== 'string' && cv._detected === true;
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
 * Compare two ViberailsConfig objects and return a list of human-readable changes.
 *
 * @param existing - The config before sync
 * @param merged - The config after merging with fresh scan results
 * @returns Array of changes, empty if configs are identical
 */
export function diffConfigs(existing: ViberailsConfig, merged: ViberailsConfig): ConfigChange[] {
  const changes: ConfigChange[] = [];

  // Stack changes
  for (const field of STACK_FIELDS) {
    const oldVal = existing.stack[field];
    const newVal = merged.stack[field];

    if (!oldVal && newVal) {
      changes.push({ type: 'added', description: `Stack: added ${displayStackName(newVal)}` });
    } else if (oldVal && newVal && oldVal !== newVal) {
      changes.push({
        type: 'changed',
        description: `Stack: ${displayStackName(oldVal)} → ${displayStackName(newVal)}`,
      });
    }
  }

  // Convention changes
  for (const key of CONVENTION_KEYS) {
    const oldVal = existing.conventions[key];
    const newVal = merged.conventions[key];
    const label = CONVENTION_LABELS[key] ?? key;

    if (!oldVal && newVal) {
      changes.push({
        type: 'added',
        description: `New convention: ${label} (${conventionStr(newVal)})`,
      });
    } else if (oldVal && newVal && isDetected(newVal)) {
      changes.push({
        type: 'changed',
        description: `Convention updated: ${label} (${conventionStr(newVal)})`,
      });
    }
  }

  // Structure changes
  for (const { key, label } of STRUCTURE_FIELDS) {
    const oldVal = existing.structure[key];
    const newVal = merged.structure[key];

    if (!oldVal && newVal) {
      changes.push({ type: 'added', description: `Structure: detected ${label} (${newVal})` });
    }
  }

  // Package changes (monorepo per-package overrides)
  const existingPaths = new Set((existing.packages ?? []).map((p) => p.path));
  for (const pkg of merged.packages ?? []) {
    if (!existingPaths.has(pkg.path)) {
      changes.push({ type: 'added', description: `New package: ${pkg.path}` });
    }
  }

  // Workspace changes
  const existingWsPkgs = new Set(existing.workspace?.packages ?? []);
  const mergedWsPkgs = new Set(merged.workspace?.packages ?? []);

  for (const pkg of mergedWsPkgs) {
    if (!existingWsPkgs.has(pkg)) {
      changes.push({ type: 'added', description: `Workspace: added ${pkg}` });
    }
  }
  for (const pkg of existingWsPkgs) {
    if (!mergedWsPkgs.has(pkg)) {
      changes.push({ type: 'removed', description: `Workspace: removed ${pkg}` });
    }
  }

  return changes;
}

/**
 * Format a stats delta as a human-readable string.
 *
 * @param oldStats - Statistics from the previous scan
 * @param newStats - Statistics from the current scan
 * @returns e.g. "+45 files, +3,200 lines since last sync", or undefined if no change
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
