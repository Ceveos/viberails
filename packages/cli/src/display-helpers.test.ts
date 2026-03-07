import type { DirectoryInfo } from '@viberails/types';
import { describe, expect, it } from 'vitest';
import {
  formatExtensions,
  formatRoleGroup,
  formatSummary,
  groupByRole,
} from './display-helpers.js';

describe('groupByRole', () => {
  it('groups multiple directories with the same role', () => {
    const dirs: DirectoryInfo[] = [
      { path: 'hooks/auth', role: 'hooks', fileCount: 10, confidence: 'high' },
      { path: 'hooks/data', role: 'hooks', fileCount: 20, confidence: 'high' },
      { path: 'hooks/ui', role: 'hooks', fileCount: 15, confidence: 'high' },
    ];
    const groups = groupByRole(dirs);
    expect(groups).toHaveLength(1);
    expect(groups[0].role).toBe('hooks');
    expect(groups[0].dirCount).toBe(3);
    expect(groups[0].totalFiles).toBe(45);
    expect(groups[0].singlePath).toBeUndefined();
  });

  it('sets singlePath for roles with one directory', () => {
    const dirs: DirectoryInfo[] = [
      { path: 'src/components', role: 'components', fileCount: 12, confidence: 'high' },
    ];
    const groups = groupByRole(dirs);
    expect(groups).toHaveLength(1);
    expect(groups[0].singlePath).toBe('src/components');
    expect(groups[0].dirCount).toBe(1);
  });

  it('filters out unknown role', () => {
    const dirs: DirectoryInfo[] = [
      { path: 'random', role: 'unknown', fileCount: 5, confidence: 'low' },
      { path: 'src/hooks', role: 'hooks', fileCount: 8, confidence: 'high' },
    ];
    const groups = groupByRole(dirs);
    expect(groups).toHaveLength(1);
    expect(groups[0].role).toBe('hooks');
  });

  it('returns empty array for no meaningful directories', () => {
    const dirs: DirectoryInfo[] = [
      { path: 'random', role: 'unknown', fileCount: 5, confidence: 'low' },
    ];
    expect(groupByRole(dirs)).toEqual([]);
  });

  it('groups multiple different roles', () => {
    const dirs: DirectoryInfo[] = [
      { path: 'components', role: 'components', fileCount: 10, confidence: 'high' },
      { path: 'hooks', role: 'hooks', fileCount: 5, confidence: 'high' },
      { path: 'utils', role: 'utils', fileCount: 3, confidence: 'high' },
    ];
    const groups = groupByRole(dirs);
    expect(groups).toHaveLength(3);
  });
});

describe('formatSummary', () => {
  it('formats basic statistics', () => {
    const result = formatSummary({
      totalFiles: 150,
      totalLines: 12000,
      averageFileLines: 80,
      largestFiles: [],
      filesByExtension: {},
    });
    expect(result).toBe('150 source files \u00b7 12,000 lines \u00b7 avg 80 lines/file');
  });

  it('includes package count for monorepos', () => {
    const result = formatSummary(
      {
        totalFiles: 743,
        totalLines: 48200,
        averageFileLines: 65,
        largestFiles: [],
        filesByExtension: {},
      },
      10,
    );
    expect(result).toContain('10 packages');
    expect(result).toContain('743 source files');
  });

  it('omits package count when 1', () => {
    const result = formatSummary(
      {
        totalFiles: 50,
        totalLines: 3000,
        averageFileLines: 60,
        largestFiles: [],
        filesByExtension: {},
      },
      1,
    );
    expect(result).not.toContain('package');
  });
});

describe('formatExtensions', () => {
  it('formats extensions sorted by count', () => {
    const result = formatExtensions({ '.ts': 100, '.tsx': 50, '.js': 20 });
    expect(result).toBe('.ts 100 \u00b7 .tsx 50 \u00b7 .js 20');
  });

  it('limits to maxEntries', () => {
    const result = formatExtensions(
      { '.ts': 100, '.tsx': 50, '.js': 20, '.jsx': 10, '.mjs': 5 },
      3,
    );
    expect(result).toBe('.ts 100 \u00b7 .tsx 50 \u00b7 .js 20');
  });

  it('returns empty string for empty input', () => {
    expect(formatExtensions({})).toBe('');
  });
});

describe('formatRoleGroup', () => {
  it('shows path for single directory', () => {
    const result = formatRoleGroup({
      role: 'pages',
      label: 'Pages / Routes',
      dirCount: 1,
      totalFiles: 12,
      singlePath: 'app',
    });
    expect(result).toBe('Pages / Routes — app (12 files)');
  });

  it('shows dir count for multiple directories', () => {
    const result = formatRoleGroup({
      role: 'hooks',
      label: 'Hooks',
      dirCount: 4,
      totalFiles: 55,
    });
    expect(result).toBe('Hooks — 4 dirs (55 files)');
  });

  it('uses singular "file" for count of 1', () => {
    const result = formatRoleGroup({
      role: 'api',
      label: 'API routes',
      dirCount: 1,
      totalFiles: 1,
      singlePath: 'app/api',
    });
    expect(result).toBe('API routes — app/api (1 file)');
  });
});
