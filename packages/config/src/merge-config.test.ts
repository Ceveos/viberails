import type { ScanResult, ViberailsConfig } from '@viberails/types';
import { describe, expect, it } from 'vitest';
import { mergeConfig } from './merge-config.js';

function createScanResult(): ScanResult {
  return {
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
  };
}

function createExistingConfig(): ViberailsConfig {
  return {
    $schema: 'https://viberails.sh/schema/v1.json',
    version: 1,
    name: 'my-app',
    enforcement: 'warn',
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
    rules: {
      maxFileLines: 500, // Developer override
      maxFunctionLines: 50,
      requireTests: true,
      enforceNaming: true,
      enforceBoundaries: false,
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
    expect(merged.rules.maxFunctionLines).toBe(50);
  });

  it('does not overwrite user-confirmed convention (plain string)', () => {
    const existing = createExistingConfig();
    const scanResult = createScanResult();

    const merged = mergeConfig(existing, scanResult);

    // User confirmed kebab-case as a plain string — must not be replaced
    expect(merged.conventions.fileNaming).toBe('kebab-case');
  });

  it('adds newly detected conventions with _detected annotation', () => {
    const existing = createExistingConfig();
    const scanResult = createScanResult();

    const merged = mergeConfig(existing, scanResult);

    // componentNaming was not in existing, should be added with _detected
    expect(merged.conventions.componentNaming).toEqual({
      value: 'PascalCase',
      _confidence: 'high',
      _consistency: 94,
      _detected: true,
    });

    // hookNaming was not in existing, should be added with _detected
    expect(merged.conventions.hookNaming).toEqual({
      value: 'useXxx',
      _confidence: 'medium',
      _consistency: 78,
      _detected: true,
    });
  });

  it('preserves existing ignore patterns', () => {
    const existing = createExistingConfig();
    const scanResult = createScanResult();

    const merged = mergeConfig(existing, scanResult);

    expect(merged.ignore).toEqual(['src/generated/**', '**/*.d.ts']);
  });

  it('preserves existing name, enforcement, version, and schema', () => {
    const existing = createExistingConfig();
    const scanResult = createScanResult();

    const merged = mergeConfig(existing, scanResult);

    expect(merged.name).toBe('my-app');
    expect(merged.enforcement).toBe('warn');
    expect(merged.version).toBe(1);
    expect(merged.$schema).toBe('https://viberails.sh/schema/v1.json');
  });

  it('fills in undefined stack fields from fresh scan', () => {
    const existing = createExistingConfig();
    const scanResult = createScanResult();

    // existing has no styling, fresh scan detects it
    const merged = mergeConfig(existing, scanResult);

    expect(merged.stack.styling).toBe('tailwindcss@4');
    expect(merged.stack.framework).toBe('nextjs@15'); // existing value kept
  });

  it('fills in undefined structure fields from fresh scan', () => {
    const existing = createExistingConfig();
    const scanResult = createScanResult();

    // existing has no hooks, fresh scan detects it
    const merged = mergeConfig(existing, scanResult);

    expect(merged.structure.hooks).toBe('src/hooks');
    expect(merged.structure.pages).toBe('src/app'); // existing value kept
  });

  it('preserves existing boundary rules during merge', () => {
    const existing = createExistingConfig();
    existing.boundaries = [
      { from: '@mono/web', to: '@mono/api', allow: false, reason: 'Custom rule' },
    ];
    const scanResult = createScanResult();

    const merged = mergeConfig(existing, scanResult);

    expect(merged.boundaries).toEqual([
      { from: '@mono/web', to: '@mono/api', allow: false, reason: 'Custom rule' },
    ]);
  });

  it('takes fresh workspace from scan result', () => {
    const existing = createExistingConfig();
    existing.workspace = {
      packages: ['packages/old'],
      isMonorepo: true,
    };

    const scanResult = createScanResult();
    scanResult.workspace = {
      patterns: ['packages/*'],
      packages: [
        { name: '@mono/core', path: '/abs/core', relativePath: 'packages/core', internalDeps: [] },
        { name: '@mono/web', path: '/abs/web', relativePath: 'packages/web', internalDeps: [] },
      ],
    };

    const merged = mergeConfig(existing, scanResult);

    expect(merged.workspace).toEqual({
      packages: ['packages/core', 'packages/web'],
      isMonorepo: true,
    });
  });

  it('preserves existing package overrides and adds new ones', () => {
    const existing = createExistingConfig();
    existing.packages = [{ name: '@app/web', path: 'apps/web', stack: { framework: 'nextjs@15' } }];

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

    // Existing web override preserved (user may have edited it)
    expect(merged.packages!.find((p) => p.path === 'apps/web')).toEqual({
      name: '@app/web',
      path: 'apps/web',
      stack: { framework: 'nextjs@15' },
    });
    // New mobile override added
    expect(merged.packages!.find((p) => p.path === 'apps/mobile')).toBeDefined();
  });

  it('does not overwrite existing object-form conventions', () => {
    const existing = createExistingConfig();
    existing.conventions.componentNaming = {
      value: 'PascalCase',
      _confidence: 'high',
      _consistency: 90,
    };
    const scanResult = createScanResult();

    const merged = mergeConfig(existing, scanResult);

    // Existing object-form convention should be preserved as-is
    expect(merged.conventions.componentNaming).toEqual({
      value: 'PascalCase',
      _confidence: 'high',
      _consistency: 90,
    });
  });
});
