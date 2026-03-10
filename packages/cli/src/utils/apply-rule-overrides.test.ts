import type { ViberailsConfig } from '@viberails/types';
import { describe, expect, it } from 'vitest';
import { applyRuleOverrides } from './apply-rule-overrides.js';
import type { RuleOverrides } from './prompt-rules.js';

function makeConfig(overrides: Partial<ViberailsConfig> = {}): ViberailsConfig {
  return {
    version: 1,
    name: 'test',
    rules: {
      maxFileLines: 300,
      maxTestFileLines: 0,
      testCoverage: 80,
      enforceNaming: true,
      enforceBoundaries: false,
      enforceMissingTests: true,
    },
    packages: [
      {
        name: 'test',
        path: '.',
        stack: { language: 'typescript', packageManager: 'pnpm' },
        structure: {},
        conventions: { fileNaming: 'kebab-case' },
      },
    ],
    ...overrides,
  };
}

function makeOverrides(overrides: Partial<RuleOverrides> = {}): RuleOverrides {
  return {
    maxFileLines: 300,
    maxTestFileLines: 0,
    testCoverage: 80,
    enforceMissingTests: true,
    enforceNaming: true,
    coverageSummaryPath: 'coverage/coverage-summary.json',
    ...overrides,
  };
}

describe('applyRuleOverrides', () => {
  it('applies rule values to config', () => {
    const config = makeConfig();
    applyRuleOverrides(config, makeOverrides({ maxFileLines: 500, testCoverage: 90 }));

    expect(config.rules.maxFileLines).toBe(500);
    expect(config.rules.testCoverage).toBe(90);
  });

  it('sets coverage summaryPath on packages without one', () => {
    const config = makeConfig();
    applyRuleOverrides(config, makeOverrides({ coverageSummaryPath: 'custom/path.json' }));

    expect(config.packages[0].coverage?.summaryPath).toBe('custom/path.json');
  });

  it('does not overwrite existing coverage summaryPath', () => {
    const config = makeConfig();
    config.packages[0].coverage = { summaryPath: 'existing/path.json' };
    applyRuleOverrides(config, makeOverrides({ coverageSummaryPath: 'new/path.json' }));

    expect(config.packages[0].coverage?.summaryPath).toBe('existing/path.json');
  });

  it('updates file naming across all packages with matching old value', () => {
    const config = makeConfig({
      packages: [
        {
          name: 'root',
          path: '.',
          conventions: { fileNaming: 'kebab-case' },
        },
        {
          name: 'pkg-a',
          path: 'packages/a',
          conventions: { fileNaming: 'kebab-case' },
        },
      ],
    });

    applyRuleOverrides(config, makeOverrides({ fileNamingValue: 'camelCase' }));

    expect(config.packages[0].conventions?.fileNaming).toBe('camelCase');
    expect(config.packages[1].conventions?.fileNaming).toBe('camelCase');
  });

  it('sets coverage command when provided', () => {
    const config = makeConfig();
    applyRuleOverrides(config, makeOverrides({ coverageCommand: 'vitest run --coverage' }));

    expect(config.packages[0].coverage?.command).toBe('vitest run --coverage');
  });

  it('does not overwrite existing coverage command', () => {
    const config = makeConfig();
    config.packages[0].coverage = { command: 'existing-cmd' };
    applyRuleOverrides(config, makeOverrides({ coverageCommand: 'new-cmd' }));

    expect(config.packages[0].coverage?.command).toBe('existing-cmd');
  });

  it('leaves packages unchanged when packageOverrides is undefined', () => {
    const config = makeConfig();
    const originalPackages = config.packages;
    applyRuleOverrides(config, makeOverrides({ packageOverrides: undefined }));

    expect(config.packages).toBe(originalPackages);
  });

  it('leaves file naming unchanged when fileNamingValue is undefined', () => {
    const config = makeConfig();
    applyRuleOverrides(config, makeOverrides({ fileNamingValue: undefined }));

    expect(config.packages[0].conventions?.fileNaming).toBe('kebab-case');
  });

  it('only updates packages whose naming matches the old root value', () => {
    const config = makeConfig({
      packages: [
        {
          name: 'root',
          path: '.',
          conventions: { fileNaming: 'kebab-case' },
        },
        {
          name: 'pkg-a',
          path: 'packages/a',
          conventions: { fileNaming: 'PascalCase' },
        },
      ],
    });

    applyRuleOverrides(config, makeOverrides({ fileNamingValue: 'camelCase' }));

    expect(config.packages[0].conventions?.fileNaming).toBe('camelCase');
    expect(config.packages[1].conventions?.fileNaming).toBe('PascalCase');
  });

  it('handles empty packages array without errors', () => {
    const config = makeConfig({ packages: [] });
    expect(() =>
      applyRuleOverrides(config, makeOverrides({ coverageCommand: 'test' })),
    ).not.toThrow();
  });

  it('applies maxTestFileLines to config', () => {
    const config = makeConfig();
    applyRuleOverrides(config, makeOverrides({ maxTestFileLines: 500 }));
    expect(config.rules.maxTestFileLines).toBe(500);
  });

  it('applies componentNaming to root package', () => {
    const config = makeConfig();
    applyRuleOverrides(config, makeOverrides({ componentNaming: 'PascalCase' }));
    expect(config.packages[0].conventions?.componentNaming).toBe('PascalCase');
  });

  it('applies hookNaming to root package', () => {
    const config = makeConfig();
    applyRuleOverrides(config, makeOverrides({ hookNaming: 'useXxx' }));
    expect(config.packages[0].conventions?.hookNaming).toBe('useXxx');
  });

  it('applies importAlias to root package', () => {
    const config = makeConfig();
    applyRuleOverrides(config, makeOverrides({ importAlias: '@/*' }));
    expect(config.packages[0].conventions?.importAlias).toBe('@/*');
  });

  it('clears convention when empty string is provided', () => {
    const config = makeConfig();
    config.packages[0].conventions = { fileNaming: 'kebab-case', componentNaming: 'PascalCase' };
    applyRuleOverrides(config, makeOverrides({ componentNaming: '' }));
    expect(config.packages[0].conventions?.componentNaming).toBeUndefined();
  });

  it('sets file naming on root package when none existed before', () => {
    const config = makeConfig({
      packages: [{ name: 'root', path: '.', conventions: {} }],
    });
    applyRuleOverrides(config, makeOverrides({ fileNamingValue: 'camelCase' }));
    expect(config.packages[0].conventions?.fileNaming).toBe('camelCase');
  });
});
