import type { ViberailsConfig } from '@viberails/types';
import { BUILTIN_IGNORE } from '@viberails/config';
import { describe, expect, it } from 'vitest';
import { resolveConfigForFile, resolveIgnoreForFile } from './check-config.js';

const baseConfig: ViberailsConfig = {
  version: 2,
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
});
