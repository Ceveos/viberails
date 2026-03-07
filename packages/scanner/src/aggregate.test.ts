import type { PackageScanResult } from '@viberails/types';
import { describe, expect, it } from 'vitest';
import {
  aggregateConventions,
  aggregateStacks,
  aggregateStatistics,
  aggregateStructures,
} from './aggregate.js';

function makePackage(overrides: Partial<PackageScanResult>): PackageScanResult {
  return {
    name: 'test',
    root: '/test',
    relativePath: '',
    stack: {
      language: { name: 'javascript', version: '1' },
      packageManager: { name: 'pnpm', version: '9' },
      libraries: [],
    },
    structure: { directories: [] },
    conventions: {},
    statistics: {
      totalFiles: 0,
      totalLines: 0,
      averageFileLines: 0,
      largestFiles: [],
      filesByExtension: {},
    },
    ...overrides,
  };
}

describe('aggregateStacks', () => {
  it('returns single package stack unchanged', () => {
    const pkg = makePackage({
      stack: {
        language: { name: 'typescript', version: '5' },
        packageManager: { name: 'pnpm', version: '9' },
        framework: { name: 'nextjs', version: '15' },
        libraries: [{ name: 'zod', version: '3' }],
      },
    });
    expect(aggregateStacks([pkg])).toBe(pkg.stack);
  });

  it('picks TypeScript if any package uses it', () => {
    const result = aggregateStacks([
      makePackage({
        stack: {
          language: { name: 'javascript' },
          packageManager: { name: 'pnpm' },
          libraries: [],
        },
      }),
      makePackage({
        stack: {
          language: { name: 'typescript', version: '5' },
          packageManager: { name: 'pnpm' },
          libraries: [],
        },
      }),
    ]);
    expect(result.language).toEqual({ name: 'typescript', version: '5' });
  });

  it('picks first framework as primary', () => {
    const result = aggregateStacks([
      makePackage({
        stack: {
          language: { name: 'typescript' },
          packageManager: { name: 'pnpm' },
          framework: { name: 'nextjs', version: '15' },
          libraries: [],
        },
      }),
      makePackage({
        stack: {
          language: { name: 'typescript' },
          packageManager: { name: 'pnpm' },
          framework: { name: 'expo', version: '53' },
          libraries: [],
        },
      }),
    ]);
    expect(result.framework).toEqual({ name: 'nextjs', version: '15' });
  });

  it('includes other frameworks in libraries', () => {
    const result = aggregateStacks([
      makePackage({
        stack: {
          language: { name: 'typescript' },
          packageManager: { name: 'pnpm' },
          framework: { name: 'nextjs', version: '15' },
          libraries: [],
        },
      }),
      makePackage({
        stack: {
          language: { name: 'typescript' },
          packageManager: { name: 'pnpm' },
          framework: { name: 'expo', version: '53' },
          libraries: [{ name: 'zod', version: '3' }],
        },
      }),
    ]);
    expect(result.libraries).toEqual([
      { name: 'expo', version: '53' },
      { name: 'zod', version: '3' },
    ]);
  });

  it('deduplicates libraries', () => {
    const result = aggregateStacks([
      makePackage({
        stack: {
          language: { name: 'typescript' },
          packageManager: { name: 'pnpm' },
          libraries: [{ name: 'zod', version: '3' }],
        },
      }),
      makePackage({
        stack: {
          language: { name: 'typescript' },
          packageManager: { name: 'pnpm' },
          libraries: [{ name: 'zod', version: '3' }, { name: 'trpc' }],
        },
      }),
    ]);
    expect(result.libraries).toEqual([{ name: 'zod', version: '3' }, { name: 'trpc' }]);
  });

  it('takes first non-undefined for optional stack fields', () => {
    const result = aggregateStacks([
      makePackage({
        stack: {
          language: { name: 'typescript' },
          packageManager: { name: 'pnpm' },
          libraries: [],
        },
      }),
      makePackage({
        stack: {
          language: { name: 'typescript' },
          packageManager: { name: 'pnpm' },
          libraries: [],
          styling: { name: 'tailwindcss', version: '4' },
        },
      }),
    ]);
    expect(result.styling).toEqual({ name: 'tailwindcss', version: '4' });
  });
});

describe('aggregateStructures', () => {
  it('returns single package structure unchanged', () => {
    const pkg = makePackage({
      structure: {
        srcDir: 'src',
        directories: [{ path: 'components', role: 'components', fileCount: 5, confidence: 'high' }],
      },
    });
    expect(aggregateStructures([pkg])).toBe(pkg.structure);
  });

  it('prefixes directory paths with package relativePath', () => {
    const result = aggregateStructures([
      makePackage({
        relativePath: 'apps/web',
        structure: {
          directories: [
            { path: 'components', role: 'components', fileCount: 5, confidence: 'high' },
          ],
        },
      }),
      makePackage({
        relativePath: 'apps/mobile',
        structure: {
          directories: [{ path: 'screens', role: 'pages', fileCount: 3, confidence: 'high' }],
        },
      }),
    ]);
    expect(result.directories[0].path).toBe('apps/web/components');
    expect(result.directories[1].path).toBe('apps/mobile/screens');
  });

  it('does not prefix for single-package (empty relativePath)', () => {
    const result = aggregateStructures([
      makePackage({
        structure: {
          directories: [
            { path: 'components', role: 'components', fileCount: 5, confidence: 'high' },
          ],
        },
      }),
      makePackage({
        structure: {
          directories: [{ path: 'hooks', role: 'hooks', fileCount: 3, confidence: 'high' }],
        },
      }),
    ]);
    expect(result.directories[0].path).toBe('components');
    expect(result.directories[1].path).toBe('hooks');
  });

  it('merges all directories into flat list', () => {
    const result = aggregateStructures([
      makePackage({
        relativePath: 'apps/web',
        structure: {
          directories: [
            { path: 'components', role: 'components', fileCount: 5, confidence: 'high' },
          ],
        },
      }),
      makePackage({
        relativePath: 'apps/mobile',
        structure: {
          directories: [{ path: 'screens', role: 'pages', fileCount: 3, confidence: 'high' }],
        },
      }),
    ]);
    expect(result.directories).toHaveLength(2);
    expect(result.directories[0].path).toBe('apps/web/components');
    expect(result.directories[1].path).toBe('apps/mobile/screens');
  });

  it('sets srcDir to src if any package uses it', () => {
    const result = aggregateStructures([
      makePackage({ structure: { directories: [] } }),
      makePackage({ structure: { srcDir: 'src', directories: [] } }),
    ]);
    expect(result.srcDir).toBe('src');
  });

  it('picks most common test pattern', () => {
    const result = aggregateStructures([
      makePackage({
        structure: {
          directories: [],
          testPattern: { value: '*.test.ts', confidence: 'high', sampleSize: 10, consistency: 95 },
        },
      }),
      makePackage({
        structure: {
          directories: [],
          testPattern: { value: '*.test.ts', confidence: 'high', sampleSize: 5, consistency: 90 },
        },
      }),
      makePackage({
        structure: {
          directories: [],
          testPattern: { value: '*.spec.ts', confidence: 'high', sampleSize: 3, consistency: 100 },
        },
      }),
    ]);
    expect(result.testPattern?.value).toBe('*.test.ts');
  });
});

describe('aggregateConventions', () => {
  it('returns single package conventions unchanged', () => {
    const pkg = makePackage({
      conventions: {
        fileNaming: { value: 'kebab-case', confidence: 'high', sampleSize: 20, consistency: 95 },
      },
    });
    expect(aggregateConventions([pkg])).toBe(pkg.conventions);
  });

  it('reports shared convention when all agree', () => {
    const result = aggregateConventions([
      makePackage({
        conventions: {
          fileNaming: { value: 'kebab-case', confidence: 'high', sampleSize: 20, consistency: 95 },
        },
      }),
      makePackage({
        conventions: {
          fileNaming: { value: 'kebab-case', confidence: 'high', sampleSize: 15, consistency: 90 },
        },
      }),
    ]);
    expect(result.fileNaming.value).toBe('kebab-case');
    // avg consistency = (95+90)/2 = 92.5, agreement = 1.0, result = 93 (rounded)
    expect(result.fileNaming.consistency).toBe(93);
    expect(result.fileNaming.confidence).toBe('high');
  });

  it('lowers confidence when packages disagree', () => {
    const result = aggregateConventions([
      makePackage({
        conventions: {
          fileNaming: { value: 'kebab-case', confidence: 'high', sampleSize: 20, consistency: 95 },
        },
      }),
      makePackage({
        conventions: {
          fileNaming: { value: 'kebab-case', confidence: 'high', sampleSize: 15, consistency: 95 },
        },
      }),
      makePackage({
        conventions: {
          fileNaming: { value: 'PascalCase', confidence: 'high', sampleSize: 10, consistency: 100 },
        },
      }),
    ]);
    expect(result.fileNaming.value).toBe('kebab-case');
    // avg consistency of majority = 95, agreement = 2/3, result = 63
    expect(result.fileNaming.consistency).toBe(63);
    expect(result.fileNaming.confidence).toBe('low');
  });

  it('omits convention when fewer than half of packages have it', () => {
    const result = aggregateConventions([
      makePackage({
        conventions: {
          fileNaming: { value: 'kebab-case', confidence: 'high', sampleSize: 20, consistency: 95 },
        },
      }),
      makePackage({ conventions: {} }),
      makePackage({ conventions: {} }),
    ]);
    expect(result.fileNaming).toBeUndefined();
  });

  it('sums sample sizes for majority value', () => {
    const result = aggregateConventions([
      makePackage({
        conventions: {
          fileNaming: { value: 'kebab-case', confidence: 'high', sampleSize: 20, consistency: 95 },
        },
      }),
      makePackage({
        conventions: {
          fileNaming: { value: 'kebab-case', confidence: 'high', sampleSize: 15, consistency: 90 },
        },
      }),
    ]);
    expect(result.fileNaming.sampleSize).toBe(35);
  });
});

describe('aggregateStatistics', () => {
  it('returns single package statistics unchanged', () => {
    const pkg = makePackage({
      statistics: {
        totalFiles: 10,
        totalLines: 500,
        averageFileLines: 50,
        largestFiles: [],
        filesByExtension: {},
      },
    });
    expect(aggregateStatistics([pkg])).toBe(pkg.statistics);
  });

  it('sums totals across packages', () => {
    const result = aggregateStatistics([
      makePackage({
        statistics: {
          totalFiles: 10,
          totalLines: 500,
          averageFileLines: 50,
          largestFiles: [],
          filesByExtension: { '.ts': 8, '.tsx': 2 },
        },
      }),
      makePackage({
        statistics: {
          totalFiles: 5,
          totalLines: 200,
          averageFileLines: 40,
          largestFiles: [],
          filesByExtension: { '.ts': 3, '.js': 2 },
        },
      }),
    ]);
    expect(result.totalFiles).toBe(15);
    expect(result.totalLines).toBe(700);
    expect(result.filesByExtension).toEqual({ '.ts': 11, '.tsx': 2, '.js': 2 });
  });

  it('recomputes average from summed totals', () => {
    const result = aggregateStatistics([
      makePackage({
        statistics: {
          totalFiles: 10,
          totalLines: 500,
          averageFileLines: 50,
          largestFiles: [],
          filesByExtension: {},
        },
      }),
      makePackage({
        statistics: {
          totalFiles: 5,
          totalLines: 200,
          averageFileLines: 40,
          largestFiles: [],
          filesByExtension: {},
        },
      }),
    ]);
    expect(result.averageFileLines).toBe(47); // 700/15 = 46.67 → 47
  });

  it('merges and re-sorts largest files', () => {
    const result = aggregateStatistics([
      makePackage({
        relativePath: 'apps/web',
        statistics: {
          totalFiles: 5,
          totalLines: 300,
          averageFileLines: 60,
          largestFiles: [
            { path: 'big.ts', lines: 200 },
            { path: 'med.ts', lines: 100 },
          ],
          filesByExtension: {},
        },
      }),
      makePackage({
        relativePath: 'apps/mobile',
        statistics: {
          totalFiles: 3,
          totalLines: 400,
          averageFileLines: 133,
          largestFiles: [
            { path: 'huge.ts', lines: 300 },
            { path: 'small.ts', lines: 50 },
          ],
          filesByExtension: {},
        },
      }),
    ]);
    expect(result.largestFiles).toEqual([
      { path: 'apps/mobile/huge.ts', lines: 300 },
      { path: 'apps/web/big.ts', lines: 200 },
      { path: 'apps/web/med.ts', lines: 100 },
      { path: 'apps/mobile/small.ts', lines: 50 },
    ]);
  });

  it('takes top 5 largest files only', () => {
    const result = aggregateStatistics([
      makePackage({
        relativePath: 'a',
        statistics: {
          totalFiles: 5,
          totalLines: 500,
          averageFileLines: 100,
          largestFiles: [
            { path: '1.ts', lines: 100 },
            { path: '2.ts', lines: 90 },
            { path: '3.ts', lines: 80 },
          ],
          filesByExtension: {},
        },
      }),
      makePackage({
        relativePath: 'b',
        statistics: {
          totalFiles: 5,
          totalLines: 500,
          averageFileLines: 100,
          largestFiles: [
            { path: '4.ts', lines: 70 },
            { path: '5.ts', lines: 60 },
            { path: '6.ts', lines: 50 },
          ],
          filesByExtension: {},
        },
      }),
    ]);
    expect(result.largestFiles).toHaveLength(5);
  });
});
