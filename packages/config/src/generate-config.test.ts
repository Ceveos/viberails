import type { ScanResult } from '@viberails/types';
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
  };
}

describe('generateConfig', () => {
  it('generates a complete config from a Next.js 15 scan result', () => {
    const scanResult = createNextjs15ScanResult();
    const config = generateConfig(scanResult);

    expect(config.$schema).toBe('https://viberails.sh/schema/v1.json');
    expect(config.version).toBe(1);
    expect(config.name).toBe('my-app');
    expect(config.enforcement).toBe('warn');

    expect(config.stack.framework).toBe('nextjs@15');
    expect(config.stack.language).toBe('typescript');
    expect(config.stack.styling).toBe('tailwindcss@4');
    expect(config.stack.packageManager).toBe('pnpm');
    expect(config.stack.linter).toBe('eslint@9');
    expect(config.stack.testRunner).toBe('vitest');

    expect(config.structure.srcDir).toBe('src');
    expect(config.structure.pages).toBe('src/app');
    expect(config.structure.components).toBe('src/components');
    expect(config.structure.hooks).toBe('src/hooks');
    expect(config.structure.utils).toBe('src/lib');
    expect(config.structure.types).toBe('src/types');
    expect(config.structure.tests).toBe('__tests__');
    expect(config.structure.testPattern).toBe('*.test.ts');
  });

  it('maps formatter from scan result to config', () => {
    const scanResult = createNextjs15ScanResult();
    scanResult.stack.formatter = { name: 'prettier', version: '3' };
    const config = generateConfig(scanResult);
    expect(config.stack.formatter).toBe('prettier@3');
  });

  it('omits formatter when not detected', () => {
    const scanResult = createNextjs15ScanResult();
    const config = generateConfig(scanResult);
    expect(config.stack.formatter).toBeUndefined();
  });

  it('includes high-confidence conventions with metadata', () => {
    const scanResult = createNextjs15ScanResult();
    const config = generateConfig(scanResult);

    expect(config.conventions.fileNaming).toEqual({
      value: 'kebab-case',
      _confidence: 'high',
      _consistency: 97,
    });
    expect(config.conventions.componentNaming).toEqual({
      value: 'PascalCase',
      _confidence: 'high',
      _consistency: 94,
    });
  });

  it('includes medium-confidence conventions with annotations', () => {
    const scanResult = createNextjs15ScanResult();
    const config = generateConfig(scanResult);

    expect(config.conventions.hookNaming).toEqual({
      value: 'useXxx',
      _confidence: 'medium',
      _consistency: 78,
    });
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
    expect(config.conventions.fileNaming).toBeUndefined();
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
    expect(config.stack.framework).toBe('nextjs');
  });

  it('handles missing optional stack fields', () => {
    const scanResult = createNextjs15ScanResult();
    delete scanResult.stack.framework;
    delete scanResult.stack.styling;
    delete scanResult.stack.backend;
    delete scanResult.stack.linter;
    delete scanResult.stack.testRunner;

    const config = generateConfig(scanResult);
    expect(config.stack.framework).toBeUndefined();
    expect(config.stack.styling).toBeUndefined();
    expect(config.stack.backend).toBeUndefined();
    expect(config.stack.linter).toBeUndefined();
    expect(config.stack.testRunner).toBeUndefined();
    expect(config.stack.language).toBe('typescript');
    expect(config.stack.packageManager).toBe('pnpm');
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
    expect(config.conventions).toEqual({});
  });

  it('includes workspace config when scan result has workspace', () => {
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

    const config = generateConfig(scanResult);

    expect(config.workspace).toEqual({
      packages: ['packages/core', 'packages/api'],
      isMonorepo: true,
    });
    expect(config.boundaries).toEqual({ deny: {} });
  });

  it('omits workspace and boundaries when scan result has no workspace', () => {
    const scanResult = createNextjs15ScanResult();
    const config = generateConfig(scanResult);

    expect(config.workspace).toBeUndefined();
    expect(config.boundaries).toBeUndefined();
  });

  it('uses first directory found for each role', () => {
    const scanResult = createNextjs15ScanResult();
    scanResult.structure.directories = [
      { path: 'src/components', role: 'components', fileCount: 30, confidence: 'high' },
      { path: 'src/ui', role: 'components', fileCount: 10, confidence: 'medium' },
    ];

    const config = generateConfig(scanResult);
    expect(config.structure.components).toBe('src/components');
  });
});

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
}) {
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
    conventions: overrides.fileNaming ? { fileNaming: overrides.fileNaming } : {},
    statistics: {
      totalFiles: 10,
      totalLines: 500,
      averageFileLines: 50,
      largestFiles: [],
      filesByExtension: { '.ts': 10 },
    },
  };
}

describe('per-package overrides', () => {
  it('generates no overrides for single-package project', () => {
    const scanResult = createNextjs15ScanResult();
    scanResult.packages = [
      createPackageScanResult({
        name: 'my-app',
        relativePath: '.',
        framework: { name: 'nextjs', version: '15' },
        fileNaming: { value: 'kebab-case', confidence: 'high', sampleSize: 100, consistency: 97 },
      }),
    ];

    const config = generateConfig(scanResult);
    expect(config.packages).toBeUndefined();
  });

  it('generates overrides when package conventions differ', () => {
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
    expect(config.packages).toBeDefined();
    expect(config.packages?.length).toBeGreaterThan(0);

    const mobileOverride = config.packages?.find((p) => p.path === 'apps/mobile');
    expect(mobileOverride).toBeDefined();
    expect(mobileOverride?.conventions?.fileNaming).toEqual({
      value: 'PascalCase',
      _confidence: 'high',
      _consistency: 100,
    });
  });

  it('omits overrides for packages matching global conventions', () => {
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
        fileNaming: { value: 'kebab-case', confidence: 'high', sampleSize: 30, consistency: 95 },
      }),
    ];

    const config = generateConfig(scanResult);
    expect(config.packages).toBeUndefined();
  });

  it('includes framework override when package framework differs from global', () => {
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
    expect(config.packages).toBeDefined();

    const mobileOverride = config.packages?.find((p) => p.path === 'apps/mobile');
    expect(mobileOverride).toBeDefined();
    expect(mobileOverride?.stack?.framework).toBe('expo@53');
  });

  it('includes styling override when package styling differs from global', () => {
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
    expect(config.packages).toBeDefined();

    const mobileOverride = config.packages?.find((p) => p.path === 'apps/mobile');
    expect(mobileOverride).toBeDefined();
    expect(mobileOverride?.stack?.styling).toBe('nativewind@4');
    // Framework matches global, so it should not be in the override
    expect(mobileOverride?.stack?.framework).toBeUndefined();
  });
});
