import type { PackageScanResult, ScanResult } from '@viberails/types';
import { describe, expect, it } from 'vitest';
import { formatMonorepoResultsText, formatPackageSummary } from './display-monorepo.js';

function makePkg(overrides: Partial<PackageScanResult> = {}): PackageScanResult {
  return {
    name: 'test-pkg',
    root: '/test/packages/web',
    relativePath: 'packages/web',
    stack: {
      language: { name: 'typescript', version: '5' },
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
      filesByExtension: { '.ts': 20 },
    },
    ...overrides,
  };
}

function makeMonorepoScan(packages: PackageScanResult[]): ScanResult {
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
      totalFiles: 40,
      totalLines: 2000,
      averageFileLines: 50,
      largestFiles: [],
      filesByExtension: { '.ts': 40 },
    },
    packages,
  };
}

describe('formatPackageSummary', () => {
  it('includes package path and file count', () => {
    const result = formatPackageSummary(makePkg());
    expect(result).toContain('packages/web');
    expect(result).toContain('20 files');
  });

  it('includes framework when present', () => {
    const pkg = makePkg({
      stack: {
        language: { name: 'typescript' },
        packageManager: { name: 'pnpm' },
        framework: { name: 'nextjs', version: '15' },
        libraries: [],
      },
    });
    const result = formatPackageSummary(pkg);
    expect(result).toContain('Next.js');
  });
});

describe('formatMonorepoResultsText', () => {
  it('includes monorepo heading with package count', () => {
    const scan = makeMonorepoScan([makePkg(), makePkg({ relativePath: 'packages/api' })]);
    const text = formatMonorepoResultsText(scan);
    expect(text).toContain('monorepo');
    expect(text).toContain('2 packages');
  });

  it('includes shared stack items', () => {
    const scan = makeMonorepoScan([makePkg()]);
    const text = formatMonorepoResultsText(scan);
    expect(text).toContain('typescript');
    expect(text).toContain('pnpm');
  });
});
