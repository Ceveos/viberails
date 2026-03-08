import { BUILTIN_IGNORE } from '@viberails/config';
import type { ViberailsConfig } from '@viberails/types';
import { describe, expect, it } from 'vitest';
import { resolveConfigForFile, resolveIgnoreForFile } from './check-config.js';

const baseConfig: ViberailsConfig = {
  version: 1,
  name: 'test-project',
  rules: {
    maxFileLines: 300,
    maxTestFileLines: 0,
    testCoverage: 80,
    enforceNaming: true,
    enforceBoundaries: false,
  },
  ignore: ['generated/**'],
  packages: [
    {
      name: 'test-project',
      path: '.',
      stack: { language: 'typescript', packageManager: 'pnpm' },
      structure: {},
      conventions: { fileNaming: 'kebab-case' },
    },
  ],
};

describe('resolveConfigForFile', () => {
  it('returns root package config when no other packages match', () => {
    const resolved = resolveConfigForFile('src/utils.ts', baseConfig);
    expect(resolved.rules).toEqual(baseConfig.rules);
    expect(resolved.conventions).toEqual({ fileNaming: 'kebab-case' });
    expect(resolved.coverage).toEqual({});
  });

  it('returns merged config for file matching a package path', () => {
    const config: ViberailsConfig = {
      ...baseConfig,
      packages: [
        ...baseConfig.packages,
        {
          name: '@app/web',
          path: 'apps/web',
          conventions: { fileNaming: 'PascalCase' },
          rules: { maxFileLines: 500 },
        },
      ],
    };
    const resolved = resolveConfigForFile('apps/web/src/page.ts', config);
    expect(resolved.conventions.fileNaming).toBe('PascalCase');
    expect(resolved.rules.maxFileLines).toBe(500);
    // Non-overridden fields preserved from global
    expect(resolved.rules.testCoverage).toBe(80);
    expect(resolved.coverage).toEqual({});
  });

  it('matches the most specific (longest) package path', () => {
    const config: ViberailsConfig = {
      ...baseConfig,
      packages: [
        ...baseConfig.packages,
        { name: 'apps', path: 'apps', conventions: { fileNaming: 'camelCase' } },
        { name: '@app/web', path: 'apps/web', conventions: { fileNaming: 'PascalCase' } },
      ],
    };
    const resolved = resolveConfigForFile('apps/web/index.ts', config);
    expect(resolved.conventions.fileNaming).toBe('PascalCase');
  });

  it('falls back to root package config for unmatched files', () => {
    const config: ViberailsConfig = {
      ...baseConfig,
      packages: [
        ...baseConfig.packages,
        { name: '@app/web', path: 'apps/web', conventions: { fileNaming: 'PascalCase' } },
      ],
    };
    const resolved = resolveConfigForFile('lib/helper.ts', config);
    expect(resolved.conventions.fileNaming).toBe('kebab-case');
    expect(resolved.rules).toEqual(baseConfig.rules);
    expect(resolved.coverage).toEqual({});
  });

  it('merges defaults.coverage with package coverage overrides', () => {
    const config: ViberailsConfig = {
      ...baseConfig,
      defaults: {
        coverage: {
          command: 'npm test -- --coverage',
          summaryPath: 'coverage/coverage-summary.json',
        },
      },
      packages: [
        {
          ...baseConfig.packages[0],
          coverage: {
            summaryPath: 'custom/summary.json',
          },
        },
      ],
    };
    const resolved = resolveConfigForFile('src/utils.ts', config);
    expect(resolved.coverage).toEqual({
      command: 'npm test -- --coverage',
      summaryPath: 'custom/summary.json',
    });
  });
});

describe('resolveIgnoreForFile', () => {
  it('returns builtin + global ignore when no package-specific patterns', () => {
    const result = resolveIgnoreForFile('src/utils.ts', baseConfig);
    expect(result).toEqual([...BUILTIN_IGNORE, 'generated/**']);
  });

  it('appends package-specific ignore patterns', () => {
    const config: ViberailsConfig = {
      ...baseConfig,
      packages: [
        ...baseConfig.packages,
        {
          name: '@app/web',
          path: 'apps/web',
          ignore: ['.next/**', 'out/**'],
        },
      ],
    };
    const result = resolveIgnoreForFile('apps/web/src/page.ts', config);
    expect(result).toEqual([...BUILTIN_IGNORE, 'generated/**', '.next/**', 'out/**']);
  });

  it('applies root ignore and most-specific package ignore', () => {
    const config: ViberailsConfig = {
      ...baseConfig,
      packages: [
        {
          ...baseConfig.packages[0],
          ignore: ['root-only/**'],
        },
        {
          name: '@app',
          path: 'apps',
          ignore: ['apps-ignore/**'],
        },
        {
          name: '@app/web',
          path: 'apps/web',
          ignore: ['web-ignore/**'],
        },
      ],
    };

    const result = resolveIgnoreForFile('apps/web/src/page.ts', config);
    expect(result).toEqual([...BUILTIN_IGNORE, 'generated/**', 'root-only/**', 'web-ignore/**']);
  });
});
