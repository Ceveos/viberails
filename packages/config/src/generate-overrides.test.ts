import type { PackageScanResult, ScanResult } from '@viberails/types';
import { describe, expect, it } from 'vitest';
import { generatePackages } from './generate-packages.js';

function makePackage(overrides: Partial<PackageScanResult> = {}): PackageScanResult {
  return {
    name: '@mono/web',
    root: '/project/packages/web',
    relativePath: 'packages/web',
    stack: {
      language: { name: 'typescript' },
      packageManager: { name: 'pnpm' },
      framework: { name: 'nextjs', version: '15' },
      libraries: [],
    },
    structure: { directories: [] },
    conventions: {
      fileNaming: { value: 'kebab-case', confidence: 'high', sampleSize: 50, consistency: 97 },
    },
    statistics: {
      totalFiles: 10,
      totalLines: 500,
      averageFileLines: 50,
      largestFiles: [],
      filesByExtension: {},
    },
    ...overrides,
  };
}

function makeScanResult(packages: PackageScanResult[]): ScanResult {
  return {
    root: '/project',
    stack: {
      language: { name: 'typescript' },
      packageManager: { name: 'pnpm' },
      libraries: [],
    },
    structure: { directories: [] },
    conventions: {},
    statistics: {
      totalFiles: 20,
      totalLines: 1000,
      averageFileLines: 50,
      largestFiles: [],
      filesByExtension: {},
    },
    packages,
  };
}

describe('generatePackages', () => {
  it('generates package config when package ORM differs', () => {
    const pkg = makePackage({
      stack: {
        language: { name: 'typescript' },
        packageManager: { name: 'pnpm' },
        framework: { name: 'nextjs', version: '15' },
        orm: { name: 'drizzle', version: '0' },
        libraries: [],
      },
    });

    const result = generatePackages(makeScanResult([pkg, makePackage()]));
    const webPkg = result?.find((p) => p.path === 'packages/web');
    expect(webPkg?.stack?.orm).toBe('drizzle@0');
  });

  it('returns undefined for single-package scan results', () => {
    const result = generatePackages(makeScanResult([makePackage()]));
    expect(result).toBeUndefined();
  });

  it('generates self-contained package configs with conventions as plain strings', () => {
    const pkg1 = makePackage({
      name: '@mono/web',
      relativePath: 'packages/web',
      conventions: {
        fileNaming: { value: 'kebab-case', confidence: 'high', sampleSize: 50, consistency: 97 },
      },
    });
    const pkg2 = makePackage({
      name: '@mono/api',
      root: '/project/packages/api',
      relativePath: 'packages/api',
      conventions: {
        fileNaming: { value: 'PascalCase', confidence: 'high', sampleSize: 30, consistency: 100 },
      },
    });

    const result = generatePackages(makeScanResult([pkg1, pkg2]));
    expect(result).toBeDefined();

    const apiPkg = result?.find((p) => p.path === 'packages/api');
    expect(apiPkg).toBeDefined();
    // Conventions are plain strings, not ConventionValue objects
    expect(apiPkg?.conventions?.fileNaming).toBe('PascalCase');
  });
});
