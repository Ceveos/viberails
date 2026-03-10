import type { PackageConfig, ScanResult, ViberailsConfig } from '@viberails/types';
import { describe, expect, it } from 'vitest';
import {
  advancedNamingHint,
  boundariesHint,
  buildMainMenuOptions,
  coverageHint,
  fileLimitsHint,
  fileNamingHint,
  fileNamingStatus,
  integrationsHint,
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
    visited: { integrations: false, boundaries: false },
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

  it('returns mixed when no naming set on root', () => {
    const config = makeConfig();
    config.packages[0] = { name: 'root', path: '.' } as PackageConfig;
    expect(fileNamingHint(config, makeScanResult())).toBe(
      'mixed \u2014 will not enforce if skipped',
    );
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

  it('returns disabled when enforce is off', () => {
    const config = makeConfig();
    config.rules.enforceNaming = false;
    expect(fileNamingStatus(config)).toBe('disabled');
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

describe('advancedNamingHint', () => {
  it('returns default text when nothing set', () => {
    expect(advancedNamingHint(makeConfig())).toBe('component, hook, and alias conventions');
  });

  it('lists configured conventions', () => {
    const config = makeConfig();
    config.packages[0].conventions = {
      ...config.packages[0].conventions,
      componentNaming: 'PascalCase',
      hookNaming: 'useXxx',
    };
    expect(advancedNamingHint(config)).toBe('PascalCase components, useXxx hooks');
  });
});

describe('integrationsHint', () => {
  it('returns not configured when not visited', () => {
    expect(integrationsHint(makeState())).toBe('not configured \u2014 select to set up');
  });

  it('lists selected items', () => {
    const state = makeState({
      visited: { integrations: true, boundaries: false },
      integrations: {
        preCommitHook: true,
        claudeCodeHook: true,
        claudeMdRef: false,
        githubAction: false,
        typecheckHook: false,
        lintHook: false,
      },
    });
    expect(integrationsHint(state)).toBe('pre-commit \u00b7 Claude');
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
    const state = makeState({ visited: { integrations: false, boundaries: true } });
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

  it('uses ~ icon for disabled coverage', () => {
    const config = makeConfig();
    config.rules.testCoverage = 0;
    const opts = buildMainMenuOptions(config, makeScanResult(), makeState());
    const cov = opts.find((o) => o.value === 'coverage');
    expect(cov?.label).toContain('~');
  });

  it('uses - icon for unvisited integrations', () => {
    const opts = buildMainMenuOptions(makeConfig(), makeScanResult(), makeState());
    const item = opts.find((o) => o.value === 'integrations');
    expect(item?.label).toContain('-');
  });

  it('uses ✓ icon for visited integrations', () => {
    const state = makeState({ visited: { integrations: true, boundaries: false } });
    const opts = buildMainMenuOptions(makeConfig(), makeScanResult(), state);
    const item = opts.find((o) => o.value === 'integrations');
    expect(item?.label).toContain('✓');
  });

  it('uses - icon for advanced naming when no conventions set', () => {
    const opts = buildMainMenuOptions(makeConfig(), makeScanResult(), makeState());
    const item = opts.find((o) => o.value === 'advancedNaming');
    expect(item?.label).toContain('-');
  });

  it('uses ✓ icon for advanced naming when conventions are set', () => {
    const config = makeConfig();
    config.packages[0].conventions = {
      ...config.packages[0].conventions,
      componentNaming: 'PascalCase',
    };
    const opts = buildMainMenuOptions(config, makeScanResult(), makeState());
    const item = opts.find((o) => o.value === 'advancedNaming');
    expect(item?.label).toContain('✓');
  });
});
