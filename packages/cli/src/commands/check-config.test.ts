import type { ViberailsConfig } from '@viberails/types';
import { describe, expect, it } from 'vitest';
import { resolveConfigForFile, resolveIgnoreForFile } from './check-config.js';

const baseConfig: ViberailsConfig = {
  version: 1,
  name: 'test-project',
  enforcement: 'warn',
  stack: { language: 'typescript', packageManager: 'pnpm' },
  structure: {},
  conventions: { fileNaming: 'kebab-case' },
  rules: {
    maxFileLines: 300,
    maxTestFileLines: 0,
    maxFunctionLines: 50,
    requireTests: true,
    enforceNaming: true,
    enforceBoundaries: false,
  },
  ignore: ['dist/**', 'node_modules/**'],
};

describe('resolveConfigForFile', () => {
  it('returns global config when no packages defined', () => {
    const config = { ...baseConfig, packages: undefined };
    const resolved = resolveConfigForFile('src/utils.ts', config);
    expect(resolved.rules).toEqual(baseConfig.rules);
    expect(resolved.conventions).toEqual(baseConfig.conventions);
  });

  it('returns merged config for file matching a package path', () => {
    const config: ViberailsConfig = {
      ...baseConfig,
      packages: [
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
    expect(resolved.rules.requireTests).toBe(true);
  });

  it('matches the most specific (longest) package path', () => {
    const config: ViberailsConfig = {
      ...baseConfig,
      packages: [
        { name: 'apps', path: 'apps', conventions: { fileNaming: 'camelCase' } },
        { name: '@app/web', path: 'apps/web', conventions: { fileNaming: 'PascalCase' } },
      ],
    };
    const resolved = resolveConfigForFile('apps/web/index.ts', config);
    expect(resolved.conventions.fileNaming).toBe('PascalCase');
  });

  it('falls back to global config for unmatched files', () => {
    const config: ViberailsConfig = {
      ...baseConfig,
      packages: [{ name: '@app/web', path: 'apps/web', conventions: { fileNaming: 'PascalCase' } }],
    };
    const resolved = resolveConfigForFile('lib/helper.ts', config);
    expect(resolved.conventions.fileNaming).toBe('kebab-case');
    expect(resolved.rules).toEqual(baseConfig.rules);
  });
});

describe('resolveIgnoreForFile', () => {
  it('returns global ignore when no packages defined', () => {
    const config = { ...baseConfig, packages: undefined };
    const result = resolveIgnoreForFile('src/utils.ts', config);
    expect(result).toEqual(['dist/**', 'node_modules/**']);
  });

  it('appends package-specific ignore patterns', () => {
    const config: ViberailsConfig = {
      ...baseConfig,
      packages: [
        {
          name: '@app/web',
          path: 'apps/web',
          ignore: ['.next/**', 'out/**'],
        },
      ],
    };
    const result = resolveIgnoreForFile('apps/web/src/page.ts', config);
    expect(result).toEqual(['dist/**', 'node_modules/**', '.next/**', 'out/**']);
  });
});
