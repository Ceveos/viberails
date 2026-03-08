import type { ViberailsConfig } from '@viberails/types';
import { describe, expect, it } from 'vitest';
import { compactConfig, expandDefaults } from './compact-config.js';

function makeMonorepoConfig(): ViberailsConfig {
  return {
    version: 1,
    name: 'mono',
    rules: {
      maxFileLines: 300,
      maxTestFileLines: 0,
      testCoverage: 80,
      enforceNaming: false,
      enforceBoundaries: false,
      enforceMissingTests: true,
    },
    ignore: [],
    packages: [
      {
        name: '@mono/web',
        path: 'apps/web',
        stack: { language: 'typescript', packageManager: 'pnpm' },
        structure: {},
        conventions: {},
        coverage: {
          command: 'pnpm test:coverage',
          summaryPath: 'coverage/coverage-summary.json',
        },
      },
      {
        name: '@mono/api',
        path: 'apps/api',
        stack: { language: 'typescript', packageManager: 'pnpm' },
        structure: {},
        conventions: {},
        coverage: {
          command: 'pnpm test:coverage',
          summaryPath: 'coverage/coverage-summary.json',
        },
      },
    ],
  };
}

describe('compactConfig / expandDefaults coverage handling', () => {
  it('extracts shared coverage settings into defaults', () => {
    const compacted = compactConfig(makeMonorepoConfig());
    expect(compacted.defaults?.coverage).toEqual({
      command: 'pnpm test:coverage',
      summaryPath: 'coverage/coverage-summary.json',
    });
    expect(compacted.packages[0].coverage).toBeUndefined();
    expect(compacted.packages[1].coverage).toBeUndefined();
  });

  it('expands defaults.coverage into package coverage with overrides', () => {
    const config: ViberailsConfig = {
      version: 1,
      name: 'mono',
      rules: {
        maxFileLines: 300,
        maxTestFileLines: 0,
        testCoverage: 80,
        enforceNaming: false,
        enforceBoundaries: false,
        enforceMissingTests: true,
      },
      ignore: [],
      defaults: {
        coverage: {
          command: 'pnpm test:coverage',
          summaryPath: 'coverage/coverage-summary.json',
        },
      },
      packages: [
        {
          name: '@mono/web',
          path: 'apps/web',
          stack: { language: 'typescript', packageManager: 'pnpm' },
          structure: {},
          conventions: {},
        },
        {
          name: '@mono/api',
          path: 'apps/api',
          stack: { language: 'typescript', packageManager: 'pnpm' },
          structure: {},
          conventions: {},
          coverage: {
            summaryPath: 'custom/coverage-summary.json',
          },
        },
      ],
    };

    const expanded = expandDefaults(config);
    expect(expanded.packages[0].coverage).toEqual({
      command: 'pnpm test:coverage',
      summaryPath: 'coverage/coverage-summary.json',
    });
    expect(expanded.packages[1].coverage).toEqual({
      command: 'pnpm test:coverage',
      summaryPath: 'custom/coverage-summary.json',
    });
  });

  it('preserves coverage settings for single-package projects', () => {
    const config: ViberailsConfig = {
      version: 1,
      name: 'single-app',
      rules: {
        maxFileLines: 300,
        maxTestFileLines: 0,
        testCoverage: 80,
        enforceNaming: false,
        enforceBoundaries: false,
        enforceMissingTests: true,
      },
      ignore: [],
      defaults: {
        coverage: {
          command: 'npx vitest run --coverage',
          summaryPath: 'coverage/coverage-summary.json',
        },
      },
      packages: [
        {
          name: 'single-app',
          path: '.',
          stack: { language: 'typescript', packageManager: 'pnpm' },
          structure: {},
          conventions: {},
        },
      ],
    };

    const compacted = compactConfig(config);
    expect(compacted.defaults).toBeUndefined();
    expect(compacted.packages[0].coverage).toEqual({
      command: 'npx vitest run --coverage',
      summaryPath: 'coverage/coverage-summary.json',
    });
  });

  it('merges defaults.coverage with existing package coverage for single-package', () => {
    const config: ViberailsConfig = {
      version: 1,
      name: 'single-app',
      rules: {
        maxFileLines: 300,
        maxTestFileLines: 0,
        testCoverage: 80,
        enforceNaming: false,
        enforceBoundaries: false,
        enforceMissingTests: true,
      },
      ignore: [],
      defaults: {
        coverage: {
          command: 'npx vitest run --coverage',
        },
      },
      packages: [
        {
          name: 'single-app',
          path: '.',
          stack: { language: 'typescript', packageManager: 'pnpm' },
          structure: {},
          conventions: {},
          coverage: {
            summaryPath: 'custom/summary.json',
          },
        },
      ],
    };

    const compacted = compactConfig(config);
    expect(compacted.packages[0].coverage).toEqual({
      command: 'npx vitest run --coverage',
      summaryPath: 'custom/summary.json',
    });
  });

  it('moves defaults.stack to package for single-package projects', () => {
    const config: ViberailsConfig = {
      version: 1,
      name: 'single-app',
      rules: {
        maxFileLines: 300,
        maxTestFileLines: 0,
        testCoverage: 80,
        enforceNaming: false,
        enforceBoundaries: false,
        enforceMissingTests: true,
      },
      ignore: [],
      defaults: {
        stack: {
          testRunner: 'vitest@3',
        },
      },
      packages: [
        {
          name: 'single-app',
          path: '.',
          stack: { language: 'typescript', packageManager: 'pnpm' },
          structure: {},
          conventions: {},
        },
      ],
    };

    const compacted = compactConfig(config);
    expect(compacted.defaults).toBeUndefined();
    expect(compacted.packages[0].stack?.testRunner).toBe('vitest@3');
  });
});
