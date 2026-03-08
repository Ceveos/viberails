import type { PackageScanResult, ScanResult, ViberailsConfig } from '@viberails/types';
import { describe, expect, it, vi } from 'vitest';
import { displayRulesPreview, displayScanResults } from './display.js';

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

function captureOutput(fn: () => void): string {
  const logs: string[] = [];
  const consoleSpy = vi.spyOn(console, 'log').mockImplementation((...args) => {
    logs.push(args.join(' '));
  });
  fn();
  consoleSpy.mockRestore();
  return logs.join('\n');
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
    const output = captureOutput(() =>
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
      ),
    );

    expect(output).not.toContain('kebab-case');
    expect(output).toContain('PascalCase');
  });

  it('filters out unknown directories from structure display', () => {
    const output = captureOutput(() =>
      displayScanResults(
        makeScanResult({
          structure: {
            directories: [
              { path: 'src/components', role: 'components', fileCount: 10, confidence: 'high' },
              { path: 'src/random', role: 'unknown', fileCount: 3, confidence: 'low' },
            ],
          },
        }),
      ),
    );

    expect(output).toContain('Components');
    expect(output).not.toContain('src/random');
  });

  it('groups structure directories by role', () => {
    const output = captureOutput(() =>
      displayScanResults(
        makeScanResult({
          structure: {
            directories: [
              { path: 'src/hooks/auth', role: 'hooks', fileCount: 10, confidence: 'high' },
              { path: 'src/hooks/data', role: 'hooks', fileCount: 20, confidence: 'high' },
              { path: 'src/hooks/ui', role: 'hooks', fileCount: 15, confidence: 'high' },
              { path: 'src/hooks/forms', role: 'hooks', fileCount: 10, confidence: 'high' },
            ],
          },
        }),
      ),
    );

    // Should show merged "Hooks — 4 dirs (55 files)" instead of individual paths
    expect(output).toContain('Hooks');
    expect(output).toContain('4 dirs');
    expect(output).toContain('55 files');
    // Individual paths should NOT appear
    expect(output).not.toContain('src/hooks/auth');
    expect(output).not.toContain('src/hooks/data');
  });

  it('shows path for single-directory roles', () => {
    const output = captureOutput(() =>
      displayScanResults(
        makeScanResult({
          structure: {
            directories: [{ path: 'src/hooks', role: 'hooks', fileCount: 8, confidence: 'high' }],
          },
        }),
      ),
    );

    expect(output).toContain('Hooks');
    expect(output).toContain('src/hooks');
    expect(output).toContain('8 files');
  });

  it('shows summary with file and line counts', () => {
    const output = captureOutput(() =>
      displayScanResults(
        makeScanResult({
          statistics: {
            totalFiles: 150,
            totalLines: 12000,
            averageFileLines: 80,
            largestFiles: [],
            filesByExtension: { '.ts': 100, '.tsx': 50 },
          },
        }),
      ),
    );

    expect(output).toContain('Summary:');
    expect(output).toContain('150 source files');
    expect(output).toContain('12,000 lines');
    expect(output).toContain('avg 80 lines/file');
    expect(output).toContain('.ts 100');
    expect(output).toContain('.tsx 50');
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
      directories: [
        { path: 'hooks/auth', role: 'hooks', fileCount: 10, confidence: 'high' },
        { path: 'hooks/data', role: 'hooks', fileCount: 20, confidence: 'high' },
        { path: 'hooks/ui', role: 'hooks', fileCount: 15, confidence: 'high' },
        { path: 'hooks/forms', role: 'hooks', fileCount: 10, confidence: 'high' },
      ],
    },
    conventions: {
      fileNaming: { value: 'PascalCase', confidence: 'high', sampleSize: 10, consistency: 100 },
    },
    statistics: { ...makeDefaultStats(), totalFiles: 55 },
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
    statistics: {
      totalFiles: 63,
      totalLines: 4800,
      averageFileLines: 76,
      largestFiles: [],
      filesByExtension: { '.ts': 40, '.tsx': 23 },
    },
    packages: [webPkg, mobilePkg, sharedPkg],
  };
}

describe('displayRulesPreview', () => {
  function makeConfig(overrides: Partial<ViberailsConfig> = {}): ViberailsConfig {
    return {
      version: 2,
      name: 'test',
      enforcement: 'warn',
      rules: {
        maxFileLines: 300,
        maxTestFileLines: 0,
        requireTests: false,
        enforceNaming: false,
        enforceBoundaries: false,
      },
      ignore: [],
      packages: [
        {
          name: 'test',
          path: '.',
          stack: { language: 'typescript', packageManager: 'pnpm' },
          structure: {},
          conventions: {},
        },
      ],
      ...overrides,
    };
  }

  it('shows max file size line', () => {
    const output = captureOutput(() => displayRulesPreview(makeConfig()));
    expect(output).toContain('Max file size: 300 lines');
  });

  it('shows require tests with pattern', () => {
    const output = captureOutput(() =>
      displayRulesPreview(
        makeConfig({
          rules: {
            maxFileLines: 300,
            maxTestFileLines: 0,
            requireTests: true,
            enforceNaming: false,
            enforceBoundaries: false,
          },
          packages: [
            {
              name: 'test',
              path: '.',
              stack: { language: 'typescript', packageManager: 'pnpm' },
              structure: { testPattern: '*.test.ts' },
              conventions: {},
            },
          ],
        }),
      ),
    );
    expect(output).toContain('Require test files: yes');
    expect(output).toContain('*.test.ts');
  });

  it('shows enforce naming with convention value', () => {
    const output = captureOutput(() =>
      displayRulesPreview(
        makeConfig({
          rules: {
            maxFileLines: 300,
            maxTestFileLines: 0,
            requireTests: false,
            enforceNaming: true,
            enforceBoundaries: false,
          },
          packages: [
            {
              name: 'test',
              path: '.',
              stack: { language: 'typescript', packageManager: 'pnpm' },
              structure: {},
              conventions: { fileNaming: 'kebab-case' },
            },
          ],
        }),
      ),
    );
    expect(output).toContain('Enforce file naming: kebab-case');
  });

  it('shows enforcement mode warn', () => {
    const output = captureOutput(() => displayRulesPreview(makeConfig()));
    expect(output).toContain('Enforcement mode:');
    expect(output).toContain('warn');
  });

  it('shows enforcement mode enforce', () => {
    const output = captureOutput(() => displayRulesPreview(makeConfig({ enforcement: 'enforce' })));
    expect(output).toContain('enforce');
    expect(output).toContain('violations will block commits');
  });

  it('handles missing conventions gracefully', () => {
    const output = captureOutput(() =>
      displayRulesPreview(
        makeConfig({
          rules: {
            maxFileLines: 300,
            maxTestFileLines: 0,
            requireTests: true,
            enforceNaming: true,
            enforceBoundaries: false,
          },
          packages: [
            {
              name: 'test',
              path: '.',
              stack: { language: 'typescript', packageManager: 'pnpm' },
              structure: {},
              conventions: {},
            },
          ],
        }),
      ),
    );
    expect(output).toContain('Enforce file naming: no');
    expect(output).toContain('Require test files: yes');
  });
});

describe('monorepo display', () => {
  it('shows package count in header', () => {
    const output = captureOutput(() => displayScanResults(makeMonorepoScanResult()));
    expect(output).toContain('monorepo');
    expect(output).toContain('3 packages');
  });

  it('shows per-package framework summary', () => {
    const output = captureOutput(() => displayScanResults(makeMonorepoScanResult()));
    expect(output).toContain('apps/web');
    expect(output).toContain('Next.js');
    expect(output).toContain('apps/mobile');
    expect(output).toContain('Expo');
  });

  it('groups structure directories by role within packages', () => {
    const output = captureOutput(() => displayScanResults(makeMonorepoScanResult()));
    expect(output).toContain('apps/web:');
    expect(output).toContain('Components');
    expect(output).toContain('apps/mobile:');
    // mobile has 4 hooks dirs merged into one group
    expect(output).toContain('Hooks');
    expect(output).toContain('4 dirs');
    expect(output).toContain('55 files');
    // shared has no meaningful dirs, should not appear in structure
    expect(output).not.toContain('packages/shared:');
  });

  it('shows per-package convention breakdown when values differ', () => {
    const output = captureOutput(() => displayScanResults(makeMonorepoScanResult()));
    expect(output).toContain('varies by package');
    expect(output).toContain('kebab-case');
    expect(output).toContain('PascalCase');
  });

  it('uses single-package display for non-monorepo', () => {
    const output = captureOutput(() => displayScanResults(makeScanResult()));
    expect(output).not.toContain('monorepo');
  });

  it('shows summary with package count for monorepo', () => {
    const output = captureOutput(() => displayScanResults(makeMonorepoScanResult()));
    expect(output).toContain('Summary:');
    expect(output).toContain('3 packages');
    expect(output).toContain('63 source files');
    expect(output).toContain('4,800 lines');
    expect(output).toContain('avg 76 lines/file');
    expect(output).toContain('.ts 40');
    expect(output).toContain('.tsx 23');
  });
});
