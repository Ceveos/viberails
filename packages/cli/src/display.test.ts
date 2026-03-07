import type { PackageScanResult, ScanResult } from '@viberails/types';
import { describe, expect, it, vi } from 'vitest';
import { displayScanResults } from './display.js';

function makeDefaultStats() {
  return {
    totalFiles: 0,
    totalLines: 0,
    averageFileLines: 0,
    largestFiles: [],
    filesByExtension: {},
  };
}

function makeScanResult(overrides: Partial<ScanResult> = {}): ScanResult {
  const stack = {
    language: { name: 'typescript' },
    packageManager: { name: 'npm' },
    libraries: [],
    ...overrides.stack,
  };
  const structure = {
    directories: [],
    ...overrides.structure,
  };
  const conventions = overrides.conventions ?? {};
  const statistics = { ...makeDefaultStats(), ...overrides.statistics };

  return {
    root: '/project',
    stack,
    structure,
    conventions,
    statistics,
    packages: overrides.packages ?? [
      {
        name: 'project',
        root: '/project',
        relativePath: '',
        stack,
        structure,
        conventions,
        statistics,
      },
    ],
  };
}

describe('displayScanResults', () => {
  it('does not throw with minimal scan result', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(() => displayScanResults(makeScanResult())).not.toThrow();
    consoleSpy.mockRestore();
  });

  it('does not throw with full scan result', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(() =>
      displayScanResults(
        makeScanResult({
          stack: {
            framework: { name: 'nextjs', version: '15' },
            language: { name: 'typescript' },
            styling: { name: 'tailwindcss', version: '4' },
            backend: { name: 'supabase' },
            linter: { name: 'eslint', version: '9' },
            testRunner: { name: 'vitest' },
            packageManager: { name: 'pnpm' },
            libraries: [{ name: 'zod', version: '3' }],
          },
          structure: {
            srcDir: 'src',
            directories: [
              { path: 'src/app', role: 'pages', fileCount: 12, confidence: 'high' },
              { path: 'src/components', role: 'components', fileCount: 47, confidence: 'high' },
            ],
          },
          conventions: {
            fileNaming: {
              value: 'kebab-case',
              confidence: 'high',
              sampleSize: 50,
              consistency: 97,
            },
            componentNaming: {
              value: 'PascalCase',
              confidence: 'high',
              sampleSize: 30,
              consistency: 94,
            },
            hookNaming: {
              value: 'camelCase:usePrefix',
              confidence: 'medium',
              sampleSize: 8,
              consistency: 78,
            },
          },
        }),
      ),
    ).not.toThrow();
    consoleSpy.mockRestore();
  });

  it('does not throw with empty conventions', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(() => displayScanResults(makeScanResult({ conventions: {} }))).not.toThrow();
    consoleSpy.mockRestore();
  });

  it('skips low-confidence conventions', () => {
    const logs: string[] = [];
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.join(' '));
    });

    displayScanResults(
      makeScanResult({
        conventions: {
          fileNaming: { value: 'kebab-case', confidence: 'low', sampleSize: 5, consistency: 50 },
          componentNaming: {
            value: 'PascalCase',
            confidence: 'high',
            sampleSize: 20,
            consistency: 95,
          },
        },
      }),
    );

    const output = logs.join('\n');
    expect(output).not.toContain('kebab-case');
    expect(output).toContain('PascalCase');
    consoleSpy.mockRestore();
  });

  it('filters out unknown directories from structure display', () => {
    const logs: string[] = [];
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.join(' '));
    });

    displayScanResults(
      makeScanResult({
        structure: {
          directories: [
            { path: 'src/components', role: 'components', fileCount: 10, confidence: 'high' },
            { path: 'src/random', role: 'unknown', fileCount: 3, confidence: 'low' },
          ],
        },
      }),
    );

    const output = logs.join('\n');
    expect(output).toContain('src/components');
    expect(output).not.toContain('src/random');
    consoleSpy.mockRestore();
  });
});

function makeMonorepoScanResult(): ScanResult {
  const webPkg: PackageScanResult = {
    name: '@app/web',
    root: '/project/apps/web',
    relativePath: 'apps/web',
    stack: {
      language: { name: 'typescript' },
      packageManager: { name: 'pnpm' },
      framework: { name: 'nextjs', version: '15' },
      styling: { name: 'tailwindcss', version: '4' },
      libraries: [],
    },
    structure: {
      directories: [
        { path: 'components', role: 'components', fileCount: 3, confidence: 'high' },
        { path: 'app/api', role: 'api', fileCount: 1, confidence: 'high' },
        { path: 'lib', role: 'utils', fileCount: 2, confidence: 'high' },
      ],
    },
    conventions: {
      fileNaming: { value: 'kebab-case', confidence: 'high', sampleSize: 20, consistency: 95 },
    },
    statistics: { ...makeDefaultStats(), totalFiles: 6 },
  };

  const mobilePkg: PackageScanResult = {
    name: '@app/mobile',
    root: '/project/apps/mobile',
    relativePath: 'apps/mobile',
    stack: {
      language: { name: 'typescript' },
      packageManager: { name: 'pnpm' },
      framework: { name: 'expo' },
      libraries: [],
    },
    structure: {
      directories: [{ path: 'hooks', role: 'hooks', fileCount: 3, confidence: 'high' }],
    },
    conventions: {
      fileNaming: { value: 'PascalCase', confidence: 'high', sampleSize: 10, consistency: 100 },
    },
    statistics: { ...makeDefaultStats(), totalFiles: 3 },
  };

  const sharedPkg: PackageScanResult = {
    name: '@app/shared',
    root: '/project/packages/shared',
    relativePath: 'packages/shared',
    stack: {
      language: { name: 'typescript' },
      packageManager: { name: 'pnpm' },
      libraries: [{ name: 'zod' }],
    },
    structure: { directories: [] },
    conventions: {},
    statistics: { ...makeDefaultStats(), totalFiles: 2 },
  };

  return {
    root: '/project',
    stack: {
      language: { name: 'typescript', version: '5' },
      packageManager: { name: 'pnpm' },
      libraries: [],
    },
    structure: { directories: [] },
    conventions: {
      fileNaming: { value: 'kebab-case', confidence: 'medium', sampleSize: 30, consistency: 75 },
    },
    statistics: { ...makeDefaultStats(), totalFiles: 11 },
    packages: [webPkg, mobilePkg, sharedPkg],
  };
}

describe('monorepo display', () => {
  it('shows package count in header', () => {
    const logs: string[] = [];
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.join(' '));
    });

    displayScanResults(makeMonorepoScanResult());
    const output = logs.join('\n');
    expect(output).toContain('monorepo');
    expect(output).toContain('3 packages');
    consoleSpy.mockRestore();
  });

  it('shows per-package framework summary', () => {
    const logs: string[] = [];
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.join(' '));
    });

    displayScanResults(makeMonorepoScanResult());
    const output = logs.join('\n');
    expect(output).toContain('apps/web');
    expect(output).toContain('Next.js');
    expect(output).toContain('apps/mobile');
    expect(output).toContain('Expo');
    consoleSpy.mockRestore();
  });

  it('groups structure directories by package', () => {
    const logs: string[] = [];
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.join(' '));
    });

    displayScanResults(makeMonorepoScanResult());
    const output = logs.join('\n');
    expect(output).toContain('apps/web:');
    expect(output).toContain('components');
    expect(output).toContain('apps/mobile:');
    expect(output).toContain('hooks');
    // shared has no meaningful dirs, should not appear in structure
    expect(output).not.toContain('packages/shared:');
    consoleSpy.mockRestore();
  });

  it('shows per-package convention breakdown when values differ', () => {
    const logs: string[] = [];
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.join(' '));
    });

    displayScanResults(makeMonorepoScanResult());
    const output = logs.join('\n');
    expect(output).toContain('varies by package');
    expect(output).toContain('kebab-case');
    expect(output).toContain('PascalCase');
    consoleSpy.mockRestore();
  });

  it('uses single-package display for non-monorepo', () => {
    const logs: string[] = [];
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.join(' '));
    });

    displayScanResults(makeScanResult());
    const output = logs.join('\n');
    expect(output).not.toContain('monorepo');
    consoleSpy.mockRestore();
  });
});
