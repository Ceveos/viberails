import type { ViberailsConfig } from '@viberails/types';
import { describe, expect, it } from 'vitest';
import { resolveConfigForFile } from './check-config.js';

const baseConfig: ViberailsConfig = {
  version: 1,
  name: 'test-monorepo',
  rules: {
    maxFileLines: 300,
    maxTestFileLines: 0,
    testCoverage: 80,
    enforceNaming: true,
    enforceBoundaries: false,
    enforceMissingTests: true,
  },
  ignore: ['dist/**'],
  packages: [
    {
      name: 'test-monorepo',
      path: '.',
      stack: { language: 'typescript', packageManager: 'pnpm' },
      structure: {},
      conventions: { fileNaming: 'kebab-case' },
    },
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

  it('returns root package config when only root package configured', () => {
    const singlePkg: ViberailsConfig = {
      ...baseConfig,
      packages: [baseConfig.packages[0]],
    };
    const resolved = resolveConfigForFile('apps/mobile/UserProfile.tsx', singlePkg);
    expect(resolved.conventions.fileNaming).toBe('kebab-case');
  });

  it('returns root package config when packages array has only root', () => {
    const rootOnly: ViberailsConfig = {
      ...baseConfig,
      packages: [baseConfig.packages[0]],
    };
    const resolved = resolveConfigForFile('apps/mobile/UserProfile.tsx', rootOnly);
    expect(resolved.conventions.fileNaming).toBe('kebab-case');
  });

  it('matches the most specific (longest) package path', () => {
    const config: ViberailsConfig = {
      ...baseConfig,
      packages: [
        baseConfig.packages[0],
        { name: 'apps', path: 'apps', conventions: { fileNaming: 'camelCase' } },
        { name: '@app/mobile', path: 'apps/mobile', conventions: { fileNaming: 'PascalCase' } },
      ],
    };
    const resolved = resolveConfigForFile('apps/mobile/Screen.tsx', config);
    expect(resolved.conventions.fileNaming).toBe('PascalCase');
  });

  it('preserves non-overridden convention fields from root package', () => {
    const config: ViberailsConfig = {
      ...baseConfig,
      packages: [
        {
          name: 'test-monorepo',
          path: '.',
          stack: { language: 'typescript', packageManager: 'pnpm' },
          structure: {},
          conventions: { fileNaming: 'kebab-case', componentNaming: 'PascalCase' },
        },
        { name: '@app/mobile', path: 'apps/mobile', conventions: { fileNaming: 'PascalCase' } },
      ],
    };
    const resolved = resolveConfigForFile('apps/mobile/Screen.tsx', config);
    expect(resolved.conventions.fileNaming).toBe('PascalCase');
    // Package conventions replace root conventions entirely for that package
  });
});
