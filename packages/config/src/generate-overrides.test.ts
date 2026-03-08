import type { PackageScanResult, ScanResult, ViberailsConfig } from '@viberails/types';
import { describe, expect, it } from 'vitest';
import { conventionsDiffer, generatePackageOverrides } from './generate-overrides.js';

function makeGlobalConfig(): ViberailsConfig {
  return {
    version: 1,
    name: 'mono',
    enforcement: 'warn',
    stack: {
      language: 'typescript',
      packageManager: 'pnpm',
      framework: 'nextjs@15',
    },
    structure: {},
    conventions: {
      fileNaming: 'kebab-case',
    },
    rules: {
      maxFileLines: 300,
      maxTestFileLines: 0,
      maxFunctionLines: 50,
      requireTests: false,
      enforceNaming: true,
      enforceBoundaries: false,
    },
    ignore: [],
  };
}

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

describe('conventionsDiffer', () => {
  it('returns undefined when all conventions match global', () => {
    const result = conventionsDiffer(
      { fileNaming: { value: 'kebab-case', confidence: 'high', sampleSize: 50, consistency: 97 } },
      { fileNaming: 'kebab-case' },
    );
    expect(result).toBeUndefined();
  });

  it('returns overrides when a convention differs', () => {
    const result = conventionsDiffer(
      {
        fileNaming: { value: 'PascalCase', confidence: 'high', sampleSize: 30, consistency: 100 },
      },
      { fileNaming: 'kebab-case' },
    );
    expect(result).toBeDefined();
    expect(result?.fileNaming).toEqual({
      value: 'PascalCase',
      _confidence: 'high',
      _consistency: 100,
    });
  });
});

describe('generatePackageOverrides', () => {
  it('generates override when package ORM differs from global', () => {
    const pkg = makePackage({
      stack: {
        language: { name: 'typescript' },
        packageManager: { name: 'pnpm' },
        framework: { name: 'nextjs', version: '15' },
        orm: { name: 'drizzle', version: '0' },
        libraries: [],
      },
    });

    const globalConfig = makeGlobalConfig();
    globalConfig.stack.orm = 'prisma@5';

    const result = generatePackageOverrides(makeScanResult([pkg, makePackage()]), globalConfig);
    const webOverride = result?.find((o) => o.path === 'packages/web');
    expect(webOverride?.stack?.orm).toBe('drizzle@0');
  });

  it('returns undefined when all packages match global config', () => {
    const result = generatePackageOverrides(
      makeScanResult([makePackage(), makePackage()]),
      makeGlobalConfig(),
    );
    expect(result).toBeUndefined();
  });

  it('returns undefined for single-package scan results', () => {
    const result = generatePackageOverrides(makeScanResult([makePackage()]), makeGlobalConfig());
    expect(result).toBeUndefined();
  });
});
