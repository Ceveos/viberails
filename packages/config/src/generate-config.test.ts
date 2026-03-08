import type { DetectedConvention, PackageScanResult, ScanResult } from '@viberails/types';
import { describe, expect, it } from 'vitest';
import { DEFAULT_IGNORE, DEFAULT_RULES } from './defaults.js';
import { generateConfig } from './generate-config.js';

function createNextjs15ScanResult(): ScanResult {
  return {
    root: '/home/user/projects/my-app',
    stack: {
      framework: { name: 'nextjs', version: '15' },
      language: { name: 'typescript' },
      styling: { name: 'tailwindcss', version: '4' },
      packageManager: { name: 'pnpm' },
      linter: { name: 'eslint', version: '9' },
      testRunner: { name: 'vitest' },
      libraries: [{ name: 'zod' }, { name: 'react-query', version: '5' }],
    },
    structure: {
      srcDir: 'src',
      directories: [
        { path: 'src/app', role: 'pages', fileCount: 12, confidence: 'high' },
        { path: 'src/components', role: 'components', fileCount: 47, confidence: 'high' },
        { path: 'src/hooks', role: 'hooks', fileCount: 8, confidence: 'high' },
        { path: 'src/lib', role: 'utils', fileCount: 14, confidence: 'high' },
        { path: 'src/types', role: 'types', fileCount: 5, confidence: 'high' },
        { path: '__tests__', role: 'tests', fileCount: 23, confidence: 'high' },
      ],
      testPattern: { value: '*.test.ts', confidence: 'high', sampleSize: 23, consistency: 95 },
    },
    conventions: {
      fileNaming: { value: 'kebab-case', confidence: 'high', sampleSize: 100, consistency: 97 },
      componentNaming: { value: 'PascalCase', confidence: 'high', sampleSize: 47, consistency: 94 },
      hookNaming: { value: 'useXxx', confidence: 'medium', sampleSize: 8, consistency: 78 },
      importAlias: { value: '@/*', confidence: 'high', sampleSize: 1, consistency: 100 },
    },
    statistics: {
      totalFiles: 109,
      totalLines: 14500,
      averageFileLines: 133,
      largestFiles: [{ path: 'src/components/data-table.tsx', lines: 487 }],
      filesByExtension: { '.ts': 42, '.tsx': 55, '.css': 12 },
    },
    packages: [
      {
        name: 'my-app',
        root: '/home/user/projects/my-app',
        relativePath: '',
        stack: {
          framework: { name: 'nextjs', version: '15' },
          language: { name: 'typescript' },
          styling: { name: 'tailwindcss', version: '4' },
          packageManager: { name: 'pnpm' },
          linter: { name: 'eslint', version: '9' },
          testRunner: { name: 'vitest' },
          libraries: [{ name: 'zod' }, { name: 'react-query', version: '5' }],
        },
        structure: {
          srcDir: 'src',
          directories: [
            { path: 'src/app', role: 'pages', fileCount: 12, confidence: 'high' },
            { path: 'src/components', role: 'components', fileCount: 47, confidence: 'high' },
            { path: 'src/hooks', role: 'hooks', fileCount: 8, confidence: 'high' },
            { path: 'src/lib', role: 'utils', fileCount: 14, confidence: 'high' },
            { path: 'src/types', role: 'types', fileCount: 5, confidence: 'high' },
            { path: '__tests__', role: 'tests', fileCount: 23, confidence: 'high' },
          ],
          testPattern: { value: '*.test.ts', confidence: 'high', sampleSize: 23, consistency: 95 },
        },
        conventions: {
          fileNaming: { value: 'kebab-case', confidence: 'high', sampleSize: 100, consistency: 97 },
          componentNaming: {
            value: 'PascalCase',
            confidence: 'high',
            sampleSize: 47,
            consistency: 94,
          },
          hookNaming: { value: 'useXxx', confidence: 'medium', sampleSize: 8, consistency: 78 },
          importAlias: { value: '@/*', confidence: 'high', sampleSize: 1, consistency: 100 },
        },
        statistics: {
          totalFiles: 109,
          totalLines: 14500,
          averageFileLines: 133,
          largestFiles: [{ path: 'src/components/data-table.tsx', lines: 487 }],
          filesByExtension: { '.ts': 42, '.tsx': 55, '.css': 12 },
        },
      },
    ],
  };
}

describe('generateConfig', () => {
  it('generates a complete packages-first config from a Next.js 15 scan result', () => {
    const scanResult = createNextjs15ScanResult();
    const config = generateConfig(scanResult);

    expect(config.$schema).toBe('https://viberails.sh/schema/v1.json');
    expect(config.version).toBe(1);
    expect(config.name).toBe('my-app');

    // Config: stack lives inside packages[0]
    expect(config.packages).toHaveLength(1);
    const pkg = config.packages[0];
    expect(pkg.name).toBe('my-app');
    expect(pkg.path).toBe('.');
    expect(pkg.stack?.framework).toBe('nextjs@15');
    expect(pkg.stack?.language).toBe('typescript');
    expect(pkg.stack?.styling).toBe('tailwindcss@4');
    expect(pkg.stack?.packageManager).toBe('pnpm');
    expect(pkg.stack?.linter).toBe('eslint@9');
    expect(pkg.stack?.testRunner).toBe('vitest');

    expect(pkg.structure?.srcDir).toBe('src');
    expect(pkg.structure?.pages).toBe('src/app');
    expect(pkg.structure?.components).toBe('src/components');
    expect(pkg.structure?.hooks).toBe('src/hooks');
    expect(pkg.structure?.utils).toBe('src/lib');
    expect(pkg.structure?.types).toBe('src/types');
    expect(pkg.structure?.tests).toBe('__tests__');
    expect(pkg.structure?.testPattern).toBe('*.test.ts');
  });

  it('maps formatter from scan result to package config', () => {
    const scanResult = createNextjs15ScanResult();
    scanResult.stack.formatter = { name: 'prettier', version: '3' };
    const config = generateConfig(scanResult);
    expect(config.packages[0].stack?.formatter).toBe('prettier@3');
  });

  it('omits formatter when not detected', () => {
    const scanResult = createNextjs15ScanResult();
    const config = generateConfig(scanResult);
    expect(config.packages[0].stack?.formatter).toBeUndefined();
  });

  it('includes high-confidence conventions as plain strings in packages', () => {
    const scanResult = createNextjs15ScanResult();
    const config = generateConfig(scanResult);

    const pkg = config.packages[0];
    // Config: conventions are plain strings
    expect(pkg.conventions?.fileNaming).toBe('kebab-case');
    expect(pkg.conventions?.componentNaming).toBe('PascalCase');
  });

  it('stores convention metadata in _meta', () => {
    const scanResult = createNextjs15ScanResult();
    const config = generateConfig(scanResult);

    const meta = config._meta?.packages?.['.']?.conventions;
    expect(meta?.fileNaming).toEqual({ value: 'kebab-case', confidence: 'high', consistency: 97 });
    expect(meta?.componentNaming).toEqual({
      value: 'PascalCase',
      confidence: 'high',
      consistency: 94,
    });
    expect(meta?.hookNaming).toEqual({ value: 'useXxx', confidence: 'medium', consistency: 78 });
  });

  it('includes medium-confidence conventions as plain strings', () => {
    const scanResult = createNextjs15ScanResult();
    const config = generateConfig(scanResult);

    expect(config.packages[0].conventions?.hookNaming).toBe('useXxx');
  });

  it('omits low-confidence conventions', () => {
    const scanResult = createNextjs15ScanResult();
    scanResult.conventions.fileNaming = {
      value: 'kebab-case',
      confidence: 'low',
      sampleSize: 10,
      consistency: 55,
    };

    const config = generateConfig(scanResult);
    expect(config.packages[0].conventions?.fileNaming).toBeUndefined();
  });

  it('applies default rules', () => {
    const scanResult = createNextjs15ScanResult();
    const config = generateConfig(scanResult);

    expect(config.rules).toEqual(DEFAULT_RULES);
  });

  it('sets default ignore patterns', () => {
    const scanResult = createNextjs15ScanResult();
    const config = generateConfig(scanResult);

    expect(config.ignore).toEqual(DEFAULT_IGNORE);
  });

  it('derives project name from root path basename', () => {
    const scanResult = createNextjs15ScanResult();
    scanResult.root = '/some/path/cool-project';

    const config = generateConfig(scanResult);
    expect(config.name).toBe('cool-project');
  });

  it('handles stack items without versions', () => {
    const scanResult = createNextjs15ScanResult();
    scanResult.stack.framework = { name: 'nextjs' };

    const config = generateConfig(scanResult);
    expect(config.packages[0].stack?.framework).toBe('nextjs');
  });

  it('handles missing optional stack fields', () => {
    const scanResult = createNextjs15ScanResult();
    delete scanResult.stack.framework;
    delete scanResult.stack.styling;
    delete scanResult.stack.backend;
    delete scanResult.stack.linter;
    delete scanResult.stack.testRunner;

    const config = generateConfig(scanResult);
    const pkg = config.packages[0];
    expect(pkg.stack?.framework).toBeUndefined();
    expect(pkg.stack?.styling).toBeUndefined();
    expect(pkg.stack?.backend).toBeUndefined();
    expect(pkg.stack?.linter).toBeUndefined();
    expect(pkg.stack?.testRunner).toBeUndefined();
    expect(pkg.stack?.language).toBe('typescript');
    expect(pkg.stack?.packageManager).toBe('pnpm');
  });

  it('produces valid JSON that round-trips correctly', () => {
    const scanResult = createNextjs15ScanResult();
    const config = generateConfig(scanResult);

    const json = JSON.stringify(config);
    const parsed = JSON.parse(json);
    expect(parsed).toEqual(config);
  });

  it('handles empty conventions', () => {
    const scanResult = createNextjs15ScanResult();
    scanResult.conventions = {};

    const config = generateConfig(scanResult);
    expect(config.packages[0].conventions).toEqual({});
  });

  it('generates per-package configs for monorepo with workspace', () => {
    const scanResult = createNextjs15ScanResult();
    scanResult.workspace = {
      patterns: ['packages/*'],
      packages: [
        {
          name: '@mono/core',
          path: '/abs/packages/core',
          relativePath: 'packages/core',
          internalDeps: [],
        },
        {
          name: '@mono/api',
          path: '/abs/packages/api',
          relativePath: 'packages/api',
          internalDeps: ['@mono/core'],
        },
      ],
    };
    scanResult.packages = [
      createPackageScanResult({
        name: '@mono/core',
        relativePath: 'packages/core',
        fileNaming: { value: 'kebab-case', confidence: 'high', sampleSize: 50, consistency: 97 },
      }),
      createPackageScanResult({
        name: '@mono/api',
        relativePath: 'packages/api',
        fileNaming: { value: 'kebab-case', confidence: 'high', sampleSize: 30, consistency: 95 },
      }),
    ];

    const config = generateConfig(scanResult);

    // Monorepo generates boundaries
    expect(config.boundaries).toEqual({ deny: {} });
    // packages should be generated from the workspace scan
    expect(config.packages.length).toBeGreaterThanOrEqual(2);
  });

  it('omits boundaries when scan result has no workspace', () => {
    const scanResult = createNextjs15ScanResult();
    const config = generateConfig(scanResult);

    expect(config.boundaries).toBeUndefined();
  });

  it('uses first directory found for each role', () => {
    const scanResult = createNextjs15ScanResult();
    scanResult.structure.directories = [
      { path: 'src/components', role: 'components', fileCount: 30, confidence: 'high' },
      { path: 'src/ui', role: 'components', fileCount: 10, confidence: 'medium' },
    ];

    const config = generateConfig(scanResult);
    expect(config.packages[0].structure?.components).toBe('src/components');
  });
});

function createPackageScanResult(overrides: {
  name: string;
  relativePath: string;
  framework?: { name: string; version?: string };
  fileNaming?: {
    value: string;
    confidence: 'high' | 'medium' | 'low';
    sampleSize: number;
    consistency: number;
  };
}): PackageScanResult {
  const conventions: Record<string, DetectedConvention> = {};
  if (overrides.fileNaming) {
    conventions.fileNaming = overrides.fileNaming;
  }
  return {
    name: overrides.name,
    root: `/abs/${overrides.relativePath}`,
    relativePath: overrides.relativePath,
    stack: {
      language: { name: 'typescript' } as const,
      packageManager: { name: 'pnpm' } as const,
      framework: overrides.framework,
      libraries: [],
    },
    structure: { directories: [] },
    conventions,
    statistics: {
      totalFiles: 10,
      totalLines: 500,
      averageFileLines: 50,
      largestFiles: [],
      filesByExtension: { '.ts': 10 },
    },
  };
}

function createMonorepoScanResult(): ScanResult {
  const base = createNextjs15ScanResult();
  base.workspace = {
    patterns: ['apps/*', 'packages/*'],
    packages: [
      { name: '@app/web', path: '/abs/apps/web', relativePath: 'apps/web', internalDeps: [] },
      {
        name: '@app/mobile',
        path: '/abs/apps/mobile',
        relativePath: 'apps/mobile',
        internalDeps: [],
      },
      {
        name: '@app/shared',
        path: '/abs/packages/shared',
        relativePath: 'packages/shared',
        internalDeps: [],
      },
    ],
  };
  return base;
}

describe('per-package configs in monorepo', () => {
  it('generates single package with path "." for non-monorepo project', () => {
    const scanResult = createNextjs15ScanResult();
    const config = generateConfig(scanResult);

    expect(config.packages).toHaveLength(1);
    expect(config.packages[0].path).toBe('.');
  });

  it('generates per-package configs when packages have different conventions', () => {
    const scanResult = createMonorepoScanResult();
    scanResult.packages = [
      createPackageScanResult({
        name: '@app/web',
        relativePath: 'apps/web',
        framework: { name: 'nextjs', version: '15' },
        fileNaming: { value: 'kebab-case', confidence: 'high', sampleSize: 50, consistency: 97 },
      }),
      createPackageScanResult({
        name: '@app/mobile',
        relativePath: 'apps/mobile',
        framework: { name: 'nextjs', version: '15' },
        fileNaming: { value: 'PascalCase', confidence: 'high', sampleSize: 30, consistency: 100 },
      }),
    ];

    const config = generateConfig(scanResult);
    expect(config.packages.length).toBeGreaterThan(0);

    const mobilePackage = config.packages.find((p) => p.path === 'apps/mobile');
    expect(mobilePackage).toBeDefined();
    // Config: conventions are plain strings
    expect(mobilePackage?.conventions?.fileNaming).toBe('PascalCase');
  });

  it('generates per-package configs when package framework differs', () => {
    const scanResult = createMonorepoScanResult();
    scanResult.packages = [
      createPackageScanResult({
        name: '@app/web',
        relativePath: 'apps/web',
        framework: { name: 'nextjs', version: '15' },
        fileNaming: { value: 'kebab-case', confidence: 'high', sampleSize: 50, consistency: 97 },
      }),
      createPackageScanResult({
        name: '@app/mobile',
        relativePath: 'apps/mobile',
        framework: { name: 'expo', version: '53' },
        fileNaming: { value: 'kebab-case', confidence: 'high', sampleSize: 30, consistency: 95 },
      }),
    ];

    const config = generateConfig(scanResult);
    expect(config.packages.length).toBeGreaterThan(0);

    const mobilePackage = config.packages.find((p) => p.path === 'apps/mobile');
    expect(mobilePackage).toBeDefined();
    expect(mobilePackage?.stack?.framework).toBe('expo@53');
  });

  it('generates per-package configs with styling differences', () => {
    const scanResult = createMonorepoScanResult();
    scanResult.packages = [
      createPackageScanResult({
        name: '@app/web',
        relativePath: 'apps/web',
        framework: { name: 'nextjs', version: '15' },
        fileNaming: { value: 'kebab-case', confidence: 'high', sampleSize: 50, consistency: 97 },
      }),
      {
        ...createPackageScanResult({
          name: '@app/mobile',
          relativePath: 'apps/mobile',
          framework: { name: 'nextjs', version: '15' },
          fileNaming: { value: 'kebab-case', confidence: 'high', sampleSize: 30, consistency: 95 },
        }),
        stack: {
          language: { name: 'typescript' },
          packageManager: { name: 'pnpm' },
          framework: { name: 'nextjs', version: '15' },
          styling: { name: 'nativewind', version: '4' },
          libraries: [],
        },
      },
    ];

    const config = generateConfig(scanResult);
    expect(config.packages.length).toBeGreaterThan(0);

    const mobilePackage = config.packages.find((p) => p.path === 'apps/mobile');
    expect(mobilePackage).toBeDefined();
    expect(mobilePackage?.stack?.styling).toBe('nativewind@4');
  });

  it('sets defaults.coverage.command when testRunner is vitest', () => {
    const scanResult = createNextjs15ScanResult();
    const config = generateConfig(scanResult);
    expect(config.defaults?.coverage?.command).toContain('vitest');
    expect(config.defaults?.coverage?.command).toContain('--coverage');
  });

  it('does not set defaults.coverage.command when testRunner is absent', () => {
    const scanResult = createNextjs15ScanResult();
    delete scanResult.stack.testRunner;
    const config = generateConfig(scanResult);
    expect(config.defaults?.coverage?.command).toBeUndefined();
  });
});
