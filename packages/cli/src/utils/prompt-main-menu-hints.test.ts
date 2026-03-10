import type { PackageConfig, ScanResult, ViberailsConfig } from '@viberails/types';
import { describe, expect, it } from 'vitest';
import {
  aiContextHint,
  boundariesHint,
  buildMainMenuOptions,
  coverageHint,
  fileLimitsHint,
  fileNamingHint,
  fileNamingStatus,
  missingTestsHint,
  packageOverridesHint,
} from './prompt-main-menu-hints.js';
import type { InitMenuState } from './prompt-main-menu-types.js';

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
      { name: 'root', path: '.', conventions: { fileNaming: 'kebab-case' } } as PackageConfig,
    ],
    ...overrides,
  };
}

function makeScanResult(packages: ScanResult['packages'] = []): ScanResult {
  return {
    root: '/test',
    stack: { language: { name: 'typescript' }, packageManager: { name: 'pnpm' }, libraries: [] },
    structure: { directories: [] },
    conventions: {},
    statistics: {
      totalFiles: 10,
      totalLines: 500,
      averageFileLines: 50,
      largestFiles: [],
      filesByExtension: {},
    },
    packages,
  };
}

function makeState(overrides: Partial<InitMenuState> = {}): InitMenuState {
  return {
    visited: { boundaries: false },
    deferredInstalls: [],
    hasTestRunner: true,
    hookManager: undefined,
    ...overrides,
  };
}

describe('fileLimitsHint', () => {
  it('returns line count for default config', () => {
    expect(fileLimitsHint(makeConfig())).toBe('300 lines');
  });

  it('includes test limit when set', () => {
    const config = makeConfig();
    config.rules.maxTestFileLines = 500;
    expect(fileLimitsHint(config)).toBe('300 lines, tests 500');
  });
});

describe('fileNamingHint', () => {
  it('returns detected naming with high confidence', () => {
    const scan = makeScanResult([
      {
        relativePath: '.',
        conventions: {
          fileNaming: { value: 'kebab-case', confidence: 'high', consistency: 95, sampleSize: 50 },
        },
      } as unknown as ScanResult['packages'][0],
    ]);
    expect(fileNamingHint(makeConfig(), scan)).toBe('kebab-case (detected)');
  });

  it('returns not set when no naming on root', () => {
    const config = makeConfig();
    config.packages[0] = { name: 'root', path: '.' } as PackageConfig;
    expect(fileNamingHint(config, makeScanResult())).toBe('not set \u2014 select to configure');
  });

  it('returns not enforced when disabled', () => {
    const config = makeConfig();
    config.rules.enforceNaming = false;
    expect(fileNamingHint(config, makeScanResult())).toBe('not enforced');
  });
});

describe('fileNamingStatus', () => {
  it('returns ok when naming is set', () => {
    expect(fileNamingStatus(makeConfig())).toBe('ok');
  });

  it('returns needs-input when no naming on root', () => {
    const config = makeConfig();
    config.packages[0] = { name: 'root', path: '.' } as PackageConfig;
    expect(fileNamingStatus(config)).toBe('needs-input');
  });

  it('returns unconfigured when enforce is off', () => {
    const config = makeConfig();
    config.rules.enforceNaming = false;
    expect(fileNamingStatus(config)).toBe('unconfigured');
  });
});

describe('missingTestsHint', () => {
  it('returns enforced', () => {
    expect(missingTestsHint(makeConfig())).toBe('enforced');
  });

  it('returns enforced with pattern', () => {
    const config = makeConfig();
    (config.packages[0] as PackageConfig).structure = { testPattern: '*.test.ts' };
    expect(missingTestsHint(config)).toBe('enforced (*.test.ts)');
  });

  it('returns not enforced when disabled', () => {
    const config = makeConfig();
    config.rules.enforceMissingTests = false;
    expect(missingTestsHint(config)).toBe('not enforced');
  });
});

describe('coverageHint', () => {
  it('returns percentage for standard config', () => {
    expect(coverageHint(makeConfig(), true)).toBe('80%');
  });

  it('returns disabled when zero', () => {
    const config = makeConfig();
    config.rules.testCoverage = 0;
    expect(coverageHint(config, true)).toBe('disabled');
  });

  it('returns inactive when no test runner', () => {
    expect(coverageHint(makeConfig(), false)).toBe('80% target (inactive \u2014 no test runner)');
  });

  it('returns package counts for monorepo', () => {
    const config = makeConfig();
    config.packages.push(
      { name: 'pkg-a', path: 'packages/a' } as PackageConfig,
      { name: 'pkg-b', path: 'packages/b', rules: { testCoverage: 0 } } as PackageConfig,
    );
    expect(coverageHint(config, true)).toBe('80% (2/3 packages, 1 exempt)');
  });
});

describe('aiContextHint', () => {
  it('returns none set when no conventions', () => {
    expect(aiContextHint(makeConfig())).toBe('none set \u2014 optional AI guidelines');
  });

  it('returns count when some set', () => {
    const config = makeConfig();
    config.packages[0].conventions = {
      ...config.packages[0].conventions,
      componentNaming: 'PascalCase',
    };
    expect(aiContextHint(config)).toBe('1 of 3 conventions');
  });

  it('returns all set when all conventions configured', () => {
    const config = makeConfig();
    config.packages[0].conventions = {
      ...config.packages[0].conventions,
      componentNaming: 'PascalCase',
      hookNaming: 'useXxx',
      importAlias: '@/*',
    };
    expect(aiContextHint(config)).toBe('all set');
  });
});

describe('packageOverridesHint', () => {
  it('returns package count', () => {
    const config = makeConfig();
    config.packages.push({ name: 'a', path: 'packages/a' } as PackageConfig);
    expect(packageOverridesHint(config)).toBe('1 packages');
  });

  it('shows customized count for packages with rules or coverage overrides', () => {
    const config = makeConfig();
    config.packages.push(
      { name: 'a', path: 'packages/a', rules: { testCoverage: 0 } } as PackageConfig,
      { name: 'b', path: 'packages/b' } as PackageConfig,
    );
    expect(packageOverridesHint(config)).toBe('2 packages (1 customized)');
  });

  it('does not count naming that matches root as customized', () => {
    const config = makeConfig();
    config.packages.push({
      name: 'a',
      path: 'packages/a',
      conventions: { fileNaming: 'kebab-case' },
    } as PackageConfig);
    expect(packageOverridesHint(config)).toBe('1 packages');
  });

  it('counts naming override that differs from root as customized', () => {
    const config = makeConfig();
    config.packages.push({
      name: 'a',
      path: 'packages/a',
      conventions: { fileNaming: 'PascalCase' },
    } as PackageConfig);
    expect(packageOverridesHint(config)).toBe('1 packages (1 customized)');
  });
});

describe('boundariesHint', () => {
  it('returns not enabled by default', () => {
    expect(boundariesHint(makeConfig(), makeState())).toBe('not enabled');
  });

  it('returns rule count when enabled', () => {
    const config = makeConfig();
    config.rules.enforceBoundaries = true;
    config.boundaries = { deny: { '@pkg/a': ['@pkg/b', '@pkg/c'], '@pkg/d': ['@pkg/e'] } };
    const state = makeState({ visited: { boundaries: true } });
    expect(boundariesHint(config, state)).toBe('3 rules across 2 packages');
  });
});

describe('buildMainMenuOptions', () => {
  it('includes boundaries for monorepos only', () => {
    const config = makeConfig();
    const scan = makeScanResult();
    const state = makeState();

    const single = buildMainMenuOptions(config, scan, state);
    expect(single.find((o) => o.value === 'boundaries')).toBeUndefined();

    config.packages.push({ name: 'pkg', path: 'packages/pkg' } as PackageConfig);
    const multi = buildMainMenuOptions(config, scan, state);
    expect(multi.find((o) => o.value === 'boundaries')).toBeDefined();
  });

  it('uses ? icon for unresolved naming', () => {
    const config = makeConfig();
    config.packages[0] = { name: 'root', path: '.' } as PackageConfig;
    const opts = buildMainMenuOptions(config, makeScanResult(), makeState());
    const naming = opts.find((o) => o.value === 'fileNaming');
    expect(naming?.label).toContain('?');
  });

  it('uses - icon for unconfigured coverage when testCoverage is 0', () => {
    const config = makeConfig();
    config.rules.testCoverage = 0;
    const opts = buildMainMenuOptions(config, makeScanResult(), makeState());
    const cov = opts.find((o) => o.value === 'coverage');
    expect(cov?.label).toContain('-');
  });

  it('uses ~ icon for partial coverage when no test runner', () => {
    const state = makeState({ hasTestRunner: false });
    const opts = buildMainMenuOptions(makeConfig(), makeScanResult(), state);
    const cov = opts.find((o) => o.value === 'coverage');
    expect(cov?.label).toContain('~');
  });

  it('includes aiContext option', () => {
    const opts = buildMainMenuOptions(makeConfig(), makeScanResult(), makeState());
    const item = opts.find((o) => o.value === 'aiContext');
    expect(item).toBeDefined();
    expect(item?.label).toContain('-');
  });

  it('uses ~ icon for aiContext when some conventions set', () => {
    const config = makeConfig();
    config.packages[0].conventions = {
      ...config.packages[0].conventions,
      componentNaming: 'PascalCase',
    };
    const opts = buildMainMenuOptions(config, makeScanResult(), makeState());
    const item = opts.find((o) => o.value === 'aiContext');
    expect(item?.label).toContain('~');
  });

  it('uses ✓ icon for aiContext when all conventions set', () => {
    const config = makeConfig();
    config.packages[0].conventions = {
      ...config.packages[0].conventions,
      componentNaming: 'PascalCase',
      hookNaming: 'useXxx',
      importAlias: '@/*',
    };
    const opts = buildMainMenuOptions(config, makeScanResult(), makeState());
    const item = opts.find((o) => o.value === 'aiContext');
    expect(item?.label).toContain('✓');
  });

  it('does not include advancedNaming or integrations', () => {
    const opts = buildMainMenuOptions(makeConfig(), makeScanResult(), makeState());
    expect(opts.find((o) => o.value === 'advancedNaming')).toBeUndefined();
    expect(opts.find((o) => o.value === 'integrations')).toBeUndefined();
  });
});
