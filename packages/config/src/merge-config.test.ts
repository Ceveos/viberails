import type { ScanResult, ViberailsConfig } from '@viberails/types';
import { describe, expect, it } from 'vitest';
import { mergeConfig } from './merge-config.js';

function createScanResult(): ScanResult {
  const result: ScanResult = {
    root: '/home/user/projects/my-app',
    stack: {
      framework: { name: 'nextjs', version: '15' },
      language: { name: 'typescript' },
      styling: { name: 'tailwindcss', version: '4' },
      packageManager: { name: 'pnpm' },
      libraries: [],
    },
    structure: {
      srcDir: 'src',
      directories: [
        { path: 'src/app', role: 'pages', fileCount: 12, confidence: 'high' },
        { path: 'src/components', role: 'components', fileCount: 47, confidence: 'high' },
        { path: 'src/hooks', role: 'hooks', fileCount: 8, confidence: 'high' },
      ],
    },
    conventions: {
      fileNaming: { value: 'kebab-case', confidence: 'high', sampleSize: 100, consistency: 97 },
      componentNaming: { value: 'PascalCase', confidence: 'high', sampleSize: 47, consistency: 94 },
      hookNaming: { value: 'useXxx', confidence: 'medium', sampleSize: 8, consistency: 78 },
    },
    statistics: {
      totalFiles: 80,
      totalLines: 10000,
      averageFileLines: 125,
      largestFiles: [],
      filesByExtension: { '.ts': 40, '.tsx': 40 },
    },
    packages: [],
  };
  result.packages = [
    {
      name: 'my-app',
      root: result.root,
      relativePath: '',
      stack: result.stack,
      structure: result.structure,
      conventions: result.conventions,
      statistics: result.statistics,
    },
  ];
  return result;
}

function createExistingConfig(): ViberailsConfig {
  return {
    $schema: 'https://viberails.sh/schema/v1.json',
    version: 1,
    name: 'my-app',
    packages: [
      {
        name: 'my-app',
        path: '.',
        stack: {
          language: 'typescript',
          packageManager: 'pnpm',
          framework: 'nextjs@15',
        },
        structure: {
          srcDir: 'src',
          pages: 'src/app',
          components: 'src/components',
        },
        conventions: {
          fileNaming: 'kebab-case', // User-confirmed (plain string)
        },
      },
    ],
    rules: {
      maxFileLines: 500, // Developer override
      maxTestFileLines: 0,
      testCoverage: 80,
      enforceNaming: true,
      enforceBoundaries: false,
      enforceMissingTests: true,
    },
    ignore: ['src/generated/**', '**/*.d.ts'],
  };
}

describe('mergeConfig', () => {
  it('preserves developer rule overrides', () => {
    const existing = createExistingConfig();
    const scanResult = createScanResult();

    const merged = mergeConfig(existing, scanResult);

    expect(merged.rules.maxFileLines).toBe(500);
  });

  it('does not overwrite user-confirmed convention (plain string)', () => {
    const existing = createExistingConfig();
    const scanResult = createScanResult();

    const merged = mergeConfig(existing, scanResult);

    // User confirmed kebab-case as a plain string — must not be replaced
    const pkg = merged.packages.find((p) => p.path === '.');
    expect(pkg?.conventions?.fileNaming).toBe('kebab-case');
  });

  it('adds newly detected conventions as plain strings with detected meta', () => {
    const existing = createExistingConfig();
    const scanResult = createScanResult();

    const merged = mergeConfig(existing, scanResult);

    const pkg = merged.packages.find((p) => p.path === '.');
    // Config: conventions are plain strings
    expect(pkg?.conventions?.componentNaming).toBe('PascalCase');
    expect(pkg?.conventions?.hookNaming).toBe('useXxx');

    // Metadata marks newly detected conventions
    const meta = merged._meta?.packages?.['.']?.conventions;
    expect(meta?.componentNaming?.detected).toBe(true);
    expect(meta?.hookNaming?.detected).toBe(true);
  });

  it('preserves existing ignore patterns', () => {
    const existing = createExistingConfig();
    const scanResult = createScanResult();

    const merged = mergeConfig(existing, scanResult);

    expect(merged.ignore).toEqual(['src/generated/**', '**/*.d.ts']);
  });

  it('preserves existing name, version, and schema', () => {
    const existing = createExistingConfig();
    const scanResult = createScanResult();

    const merged = mergeConfig(existing, scanResult);

    expect(merged.name).toBe('my-app');
    expect(merged.version).toBe(1);
    expect(merged.$schema).toBe('https://viberails.sh/schema/v1.json');
  });

  it('fills in undefined stack fields from fresh scan in package', () => {
    const existing = createExistingConfig();
    const scanResult = createScanResult();

    // existing package has no styling, fresh scan detects it
    const merged = mergeConfig(existing, scanResult);

    const pkg = merged.packages.find((p) => p.path === '.');
    expect(pkg?.stack?.styling).toBe('tailwindcss@4');
    expect(pkg?.stack?.framework).toBe('nextjs@15'); // existing value kept
  });

  it('fills in undefined structure fields from fresh scan in package', () => {
    const existing = createExistingConfig();
    const scanResult = createScanResult();

    // existing package has no hooks, fresh scan detects it
    const merged = mergeConfig(existing, scanResult);

    const pkg = merged.packages.find((p) => p.path === '.');
    expect(pkg?.structure?.hooks).toBe('src/hooks');
    expect(pkg?.structure?.pages).toBe('src/app'); // existing value kept
  });

  it('preserves existing boundary rules during merge', () => {
    const existing = createExistingConfig();
    existing.boundaries = {
      deny: { '@mono/web': ['@mono/api'] },
    };
    const scanResult = createScanResult();

    const merged = mergeConfig(existing, scanResult);

    expect(merged.boundaries).toEqual({
      deny: { '@mono/web': ['@mono/api'] },
    });
  });

  it('preserves existing package configs and adds new packages from scan', () => {
    const existing = createExistingConfig();
    existing.packages = [
      {
        name: '@app/web',
        path: 'apps/web',
        stack: { language: 'typescript', packageManager: 'pnpm', framework: 'nextjs@15' },
        structure: {},
        conventions: {},
      },
    ];

    const scanResult = createScanResult();
    scanResult.workspace = {
      patterns: ['apps/*'],
      packages: [
        { name: '@app/web', path: '/abs/apps/web', relativePath: 'apps/web', internalDeps: [] },
        {
          name: '@app/mobile',
          path: '/abs/apps/mobile',
          relativePath: 'apps/mobile',
          internalDeps: [],
        },
      ],
    };
    scanResult.packages = [
      {
        name: '@app/web',
        root: '/abs/apps/web',
        relativePath: 'apps/web',
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
      },
      {
        name: '@app/mobile',
        root: '/abs/apps/mobile',
        relativePath: 'apps/mobile',
        stack: {
          language: { name: 'typescript' },
          packageManager: { name: 'pnpm' },
          framework: { name: 'expo', version: '53' },
          libraries: [],
        },
        structure: { directories: [] },
        conventions: {
          fileNaming: { value: 'PascalCase', confidence: 'high', sampleSize: 30, consistency: 100 },
        },
        statistics: {
          totalFiles: 10,
          totalLines: 500,
          averageFileLines: 50,
          largestFiles: [],
          filesByExtension: {},
        },
      },
    ];

    const merged = mergeConfig(existing, scanResult);

    // Existing web package preserved (user may have edited it)
    const webPkg = merged.packages.find((p) => p.path === 'apps/web');
    expect(webPkg).toBeDefined();
    expect(webPkg?.name).toBe('@app/web');
    // New mobile package added
    expect(merged.packages.find((p) => p.path === 'apps/mobile')).toBeDefined();
  });

  it('preserves ORM field from existing config package during merge', () => {
    const existing = createExistingConfig();
    if (!existing.packages[0].stack) {
      existing.packages[0].stack = { language: 'typescript', packageManager: 'pnpm' };
    }
    existing.packages[0].stack.orm = 'prisma';
    const scanResult = createScanResult();
    scanResult.stack.orm = { name: 'drizzle', version: '0' };

    const merged = mergeConfig(existing, scanResult);

    const pkg = merged.packages.find((p) => p.path === '.');
    expect(pkg?.stack?.orm).toBe('prisma'); // existing preserved
  });

  it('fills ORM field from fresh scan when missing in existing package', () => {
    const existing = createExistingConfig();
    // existing package has no orm
    const scanResult = createScanResult();
    scanResult.stack.orm = { name: 'prisma', version: '5' };

    const merged = mergeConfig(existing, scanResult);

    const pkg = merged.packages.find((p) => p.path === '.');
    expect(pkg?.stack?.orm).toBe('prisma@5');
  });

  it('does not overwrite existing conventions in package', () => {
    const existing = createExistingConfig();
    existing.packages[0].conventions = {
      ...existing.packages[0].conventions,
      componentNaming: 'PascalCase',
    };
    const scanResult = createScanResult();

    const merged = mergeConfig(existing, scanResult);

    const pkg = merged.packages.find((p) => p.path === '.');
    // Existing convention should be preserved as-is
    expect(pkg?.conventions?.componentNaming).toBe('PascalCase');
  });
});
