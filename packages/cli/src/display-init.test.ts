import type { PackageScanResult, ScanResult, ViberailsConfig } from '@viberails/types';
import { describe, expect, it, vi } from 'vitest';
import { displayInitOverview, displaySetupPlan } from './display-init.js';

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

describe('displayInitOverview', () => {
  function makeConfig(overrides: Partial<ViberailsConfig> = {}): ViberailsConfig {
    return {
      version: 1,
      name: 'test',
      rules: {
        maxFileLines: 300,
        maxTestFileLines: 0,
        testCoverage: 80,
        enforceNaming: true,
        enforceBoundaries: false,
        enforceMissingTests: true,
      },
      packages: [
        {
          name: 'test',
          path: '.',
          stack: { language: 'typescript', packageManager: 'pnpm' },
          structure: { testPattern: '*.test.ts' },
          conventions: { fileNaming: 'kebab-case' },
        },
      ],
      ...overrides,
    };
  }

  function makeOverviewScanResult(overrides: Partial<ScanResult> = {}): ScanResult {
    return makeScanResult({
      stack: {
        framework: { name: 'nextjs', version: '16' },
        language: { name: 'typescript', version: '5' },
        packageManager: { name: 'pnpm' },
        linter: { name: 'eslint', version: '9' },
        formatter: { name: 'prettier', version: '3' },
        testRunner: { name: 'jest', version: '29' },
        libraries: [],
        ...overrides.stack,
      },
      ...overrides,
    });
  }

  it('shows max file size', () => {
    const output = captureOutput(() =>
      displayInitOverview(makeOverviewScanResult(), makeConfig(), []),
    );
    expect(output).toContain('300 lines');
  });

  it('shows a compact detected project summary', () => {
    const output = captureOutput(() =>
      displayInitOverview(makeOverviewScanResult(), makeConfig(), []),
    );
    expect(output).toContain('Ready to initialize:');
    expect(output).toContain('Next.js 16');
    expect(output).toContain('TypeScript 5');
    expect(output).toContain('pnpm');
  });

  it('shows file naming convention', () => {
    const output = captureOutput(() =>
      displayInitOverview(makeOverviewScanResult(), makeConfig(), []),
    );
    expect(output).toContain('kebab-case');
  });

  it('shows coverage target', () => {
    const output = captureOutput(() =>
      displayInitOverview(makeOverviewScanResult(), makeConfig(), []),
    );
    expect(output).toContain('80%');
  });

  it('shows disabled coverage', () => {
    const config = makeConfig({
      rules: { ...makeConfig().rules, testCoverage: 0 },
    });
    const output = captureOutput(() => displayInitOverview(makeOverviewScanResult(), config, []));
    expect(output).toContain('disabled');
  });

  it('shows missing tests enforced with pattern', () => {
    const output = captureOutput(() =>
      displayInitOverview(makeOverviewScanResult(), makeConfig(), []),
    );
    expect(output).toContain('enforced');
    expect(output).toContain('*.test.ts');
  });

  it('shows per-package coverage info for monorepos', () => {
    const scanResult = makeMonorepoScanResult();
    const config = makeConfig({
      packages: [
        {
          name: 'web',
          path: 'apps/web',
          stack: { language: 'typescript', packageManager: 'pnpm' },
        },
        {
          name: 'api',
          path: 'apps/api',
          stack: { language: 'typescript', packageManager: 'pnpm' },
        },
      ],
    });
    const output = captureOutput(() => displayInitOverview(scanResult, config, []));
    expect(output).toContain('monorepo');
    expect(output).toContain('3 packages');
    expect(output).toContain('2/2 packages');
    expect(output).toContain('Infer boundaries from current imports');
  });

  it('finds file naming from child package when root has none', () => {
    const config = makeConfig({
      rules: { ...makeConfig().rules, enforceNaming: true },
      packages: [
        {
          name: 'root',
          path: '.',
          stack: { language: 'typescript', packageManager: 'pnpm' },
        },
        {
          name: 'web',
          path: 'apps/web',
          stack: { language: 'typescript', packageManager: 'pnpm' },
          conventions: { fileNaming: 'kebab-case' },
        },
      ],
    });
    const output = captureOutput(() => displayInitOverview(makeMonorepoScanResult(), config, []));
    expect(output).toContain('kebab-case');
    expect(output).not.toContain('not enforced');
  });

  it('shows exempted packages', () => {
    const output = captureOutput(() =>
      displayInitOverview(makeOverviewScanResult(), makeConfig(), ['packages/types']),
    );
    expect(output).toContain('packages/types');
    expect(output).toContain('types-only');
  });

  it('shows integrations as optional next steps', () => {
    const output = captureOutput(() =>
      displayInitOverview(makeOverviewScanResult(), makeConfig(), []),
    );
    expect(output).toContain('Also available:');
    expect(output).toContain('Set up hooks, Claude integration, and CI checks');
  });
});

describe('displaySetupPlan', () => {
  function makeConfig(overrides: Partial<ViberailsConfig> = {}): ViberailsConfig {
    return {
      version: 1,
      name: 'test',
      rules: {
        maxFileLines: 300,
        maxTestFileLines: 0,
        testCoverage: 80,
        enforceNaming: true,
        enforceBoundaries: true,
        enforceMissingTests: true,
      },
      packages: [{ name: 'test', path: '.' }],
      ...overrides,
    };
  }

  it('shows files and selected integrations before write', () => {
    const output = captureOutput(() =>
      displaySetupPlan(
        makeConfig(),
        {
          preCommitHook: true,
          claudeCodeHook: true,
          claudeMdRef: true,
          githubAction: true,
          typecheckHook: true,
          lintHook: true,
        },
        { configFile: 'viberails.config.json' },
      ),
    );

    expect(output).toContain('Ready to write:');
    expect(output).toContain('viberails.config.json');
    expect(output).toContain('.viberails/context.md');
    expect(output).toContain('Boundary rules: inferred from current imports');
    expect(output).toContain('Integrations: pre-commit hook');
    expect(output).toContain('GitHub Actions workflow');
  });

  it('shows replacement and disabled items clearly', () => {
    const output = captureOutput(() =>
      displaySetupPlan(
        makeConfig({
          rules: { ...makeConfig().rules, enforceBoundaries: false, testCoverage: 0 },
        }),
        {
          preCommitHook: false,
          claudeCodeHook: false,
          claudeMdRef: false,
          githubAction: false,
          typecheckHook: false,
          lintHook: false,
        },
        { replacingExistingConfig: true },
      ),
    );

    expect(output).toContain('replacing existing config');
    expect(output).toContain('Boundary rules: not enabled');
    expect(output).toContain('Coverage checks: disabled');
    expect(output).toContain('Integrations: none selected');
  });
});
