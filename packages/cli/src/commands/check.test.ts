import type { ViberailsConfig } from '@viberails/types';
import { describe, expect, it } from 'vitest';
import { resolveConfigForFile } from './check.js';

const baseConfig: ViberailsConfig = {
  version: 1,
  name: 'test-monorepo',
  enforcement: 'warn',
  stack: { language: 'typescript', packageManager: 'pnpm' },
  structure: {},
  conventions: { fileNaming: 'kebab-case' },
  rules: {
    maxFileLines: 300,
    maxFunctionLines: 50,
    requireTests: true,
    enforceNaming: true,
    enforceBoundaries: false,
  },
  ignore: ['dist/**'],
  packages: [
    {
      name: '@app/mobile',
      path: 'apps/mobile',
      conventions: { fileNaming: 'PascalCase' },
    },
    {
      name: '@app/web',
      path: 'apps/web',
      rules: { maxFileLines: 500 },
    },
  ],
};

describe('resolveConfigForFile', () => {
  it('returns global config for files outside any package', () => {
    const resolved = resolveConfigForFile('src/utils.ts', baseConfig);
    expect(resolved.conventions.fileNaming).toBe('kebab-case');
    expect(resolved.rules.maxFileLines).toBe(300);
  });

  it('returns package convention override for files inside a package', () => {
    const resolved = resolveConfigForFile('apps/mobile/UserProfile.tsx', baseConfig);
    expect(resolved.conventions.fileNaming).toBe('PascalCase');
  });

  it('returns package rule override for files inside a package', () => {
    const resolved = resolveConfigForFile('apps/web/src/page.ts', baseConfig);
    expect(resolved.rules.maxFileLines).toBe(500);
    // Non-overridden rules remain from global
    expect(resolved.rules.enforceNaming).toBe(true);
  });

  it('returns global config when no packages configured', () => {
    const noPackages = { ...baseConfig, packages: undefined };
    const resolved = resolveConfigForFile('apps/mobile/UserProfile.tsx', noPackages);
    expect(resolved.conventions.fileNaming).toBe('kebab-case');
  });

  it('returns global config when packages array is empty', () => {
    const emptyPackages = { ...baseConfig, packages: [] };
    const resolved = resolveConfigForFile('apps/mobile/UserProfile.tsx', emptyPackages);
    expect(resolved.conventions.fileNaming).toBe('kebab-case');
  });

  it('matches the most specific (longest) package path', () => {
    const config: ViberailsConfig = {
      ...baseConfig,
      packages: [
        { name: 'apps', path: 'apps', conventions: { fileNaming: 'camelCase' } },
        { name: '@app/mobile', path: 'apps/mobile', conventions: { fileNaming: 'PascalCase' } },
      ],
    };
    const resolved = resolveConfigForFile('apps/mobile/Screen.tsx', config);
    expect(resolved.conventions.fileNaming).toBe('PascalCase');
  });

  it('preserves non-overridden convention fields from global', () => {
    const config: ViberailsConfig = {
      ...baseConfig,
      conventions: { fileNaming: 'kebab-case', componentNaming: 'PascalCase' },
      packages: [
        { name: '@app/mobile', path: 'apps/mobile', conventions: { fileNaming: 'PascalCase' } },
      ],
    };
    const resolved = resolveConfigForFile('apps/mobile/Screen.tsx', config);
    expect(resolved.conventions.fileNaming).toBe('PascalCase');
    expect(resolved.conventions.componentNaming).toBe('PascalCase');
  });
});
