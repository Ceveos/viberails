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
});
