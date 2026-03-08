import type { ScanResult } from '@viberails/types';
import { describe, expect, it } from 'vitest';
import { generatePackages } from './generate-packages.js';

function makeSinglePackageScan(): ScanResult {
  return {
    root: '/test',
    stack: {
      language: { name: 'typescript', version: '5' },
      packageManager: { name: 'pnpm' },
      libraries: [],
    },
    structure: { directories: [] },
    conventions: {},
    statistics: {
      totalFiles: 10,
      totalLines: 500,
      averageFileLines: 50,
      largestFiles: [],
      filesByExtension: {},
    },
    packages: [
      {
        name: 'test',
        root: '/test',
        relativePath: '.',
        stack: {
          language: { name: 'typescript', version: '5' },
          packageManager: { name: 'pnpm' },
          libraries: [],
        },
        structure: { directories: [] },
        conventions: {},
        statistics: {
          totalFiles: 10,
          totalLines: 500,
          averageFileLines: 50,
          largestFiles: [],
          filesByExtension: {},
        },
      },
    ],
  };
}

function makeMonorepoScan(): ScanResult {
  const base = makeSinglePackageScan();
  return {
    ...base,
    packages: [
      {
        name: '@test/web',
        root: '/test/packages/web',
        relativePath: 'packages/web',
        stack: {
          language: { name: 'typescript', version: '5' },
          packageManager: { name: 'pnpm' },
          framework: { name: 'nextjs', version: '15' },
          libraries: [],
        },
        structure: { directories: [], srcDir: 'src' },
        conventions: {
          fileNaming: { value: 'kebab-case', confidence: 'high', sampleSize: 10, consistency: 95 },
        },
        statistics: base.statistics,
      },
      {
        name: '@test/api',
        root: '/test/packages/api',
        relativePath: 'packages/api',
        stack: {
          language: { name: 'typescript', version: '5' },
          packageManager: { name: 'pnpm' },
          libraries: [],
        },
        structure: { directories: [] },
        conventions: {},
        statistics: base.statistics,
      },
    ],
  };
}

describe('generatePackages', () => {
  it('returns undefined for single-package projects', () => {
    expect(generatePackages(makeSinglePackageScan())).toBeUndefined();
  });

  it('returns per-package configs for monorepos', () => {
    const packages = generatePackages(makeMonorepoScan());
    expect(packages).toHaveLength(2);
    expect(packages?.[0].name).toBe('@test/web');
    expect(packages?.[0].path).toBe('packages/web');
    expect(packages?.[1].name).toBe('@test/api');
  });

  it('includes framework in package stack', () => {
    const packages = generatePackages(makeMonorepoScan());
    expect(packages?.[0].stack?.framework).toBe('nextjs@15');
  });

  it('sets testCoverage to 0 for types-only packages', () => {
    const scan = makeMonorepoScan();
    scan.packages.push({
      name: '@test/types',
      root: '/test/packages/types',
      relativePath: 'packages/types',
      stack: {
        language: { name: 'typescript', version: '5' },
        packageManager: { name: 'pnpm' },
        libraries: [],
      },
      structure: { directories: [] },
      conventions: {},
      statistics: scan.statistics,
      typesOnly: true,
    });
    const packages = generatePackages(scan);
    const typesPkg = packages?.find((p) => p.name === '@test/types');
    expect(typesPkg?.rules?.testCoverage).toBe(0);
  });

  it('does not set rules for non-types packages', () => {
    const packages = generatePackages(makeMonorepoScan());
    expect(packages?.[0].rules).toBeUndefined();
    expect(packages?.[1].rules).toBeUndefined();
  });
});
