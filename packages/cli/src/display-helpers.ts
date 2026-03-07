import type { CodebaseStatistics, DirectoryInfo, DirectoryRole } from '@viberails/types';
import { ROLE_DESCRIPTIONS } from '@viberails/types';

/**
 * A group of directories sharing the same role within a package.
 */
export interface RoleGroup {
  role: DirectoryRole;
  label: string;
  dirCount: number;
  totalFiles: number;
  singlePath?: string;
}

/**
 * Groups a package's directories by role, merging file counts.
 * Filters out `unknown` role. For single-directory roles, sets `singlePath`.
 *
 * @param directories - The directories to group.
 * @returns Array of RoleGroup entries sorted by role label.
 */
export function groupByRole(directories: DirectoryInfo[]): RoleGroup[] {
  const map = new Map<DirectoryRole, { dirs: DirectoryInfo[] }>();

  for (const dir of directories) {
    if (dir.role === 'unknown') continue;
    const existing = map.get(dir.role);
    if (existing) {
      existing.dirs.push(dir);
    } else {
      map.set(dir.role, { dirs: [dir] });
    }
  }

  const groups: RoleGroup[] = [];
  for (const [role, { dirs }] of map) {
    const label = ROLE_DESCRIPTIONS[role] ?? role;
    const totalFiles = dirs.reduce((sum, d) => sum + d.fileCount, 0);
    groups.push({
      role,
      label,
      dirCount: dirs.length,
      totalFiles,
      singlePath: dirs.length === 1 ? dirs[0].path : undefined,
    });
  }

  return groups;
}

/**
 * Format a summary line from CodebaseStatistics.
 *
 * @param stats - The codebase statistics.
 * @param packageCount - Number of packages (shown for monorepos with > 1).
 * @returns Formatted summary string, e.g. "3 packages · 743 source files · 48,200 lines · avg 65 lines/file"
 */
export function formatSummary(stats: CodebaseStatistics, packageCount?: number): string {
  const parts: string[] = [];
  if (packageCount && packageCount > 1) {
    parts.push(`${packageCount} packages`);
  }
  parts.push(`${stats.totalFiles.toLocaleString()} source files`);
  parts.push(`${stats.totalLines.toLocaleString()} lines`);
  parts.push(`avg ${Math.round(stats.averageFileLines)} lines/file`);
  return parts.join(' \u00b7 ');
}

/**
 * Format top extensions by count, e.g. ".tsx 312 · .ts 289 · .js 142".
 *
 * @param filesByExtension - Extension counts from CodebaseStatistics.
 * @param maxEntries - Maximum number of extensions to show (default 4).
 * @returns Formatted extension string.
 */
export function formatExtensions(
  filesByExtension: Record<string, number>,
  maxEntries: number = 4,
): string {
  return Object.entries(filesByExtension)
    .sort(([, a], [, b]) => b - a)
    .slice(0, maxEntries)
    .map(([ext, count]) => `${ext} ${count}`)
    .join(' \u00b7 ');
}

/**
 * Format a RoleGroup for display.
 *
 * @param group - The role group.
 * @returns Formatted string, e.g. "Hooks — 4 dirs (55 files)" or "Pages / Routes — app (12 files)"
 */
export function formatRoleGroup(group: RoleGroup): string {
  const files = group.totalFiles === 1 ? '1 file' : `${group.totalFiles} files`;
  if (group.singlePath) {
    return `${group.label} — ${group.singlePath} (${files})`;
  }
  const dirs = group.dirCount === 1 ? '1 dir' : `${group.dirCount} dirs`;
  return `${group.label} — ${dirs} (${files})`;
}
