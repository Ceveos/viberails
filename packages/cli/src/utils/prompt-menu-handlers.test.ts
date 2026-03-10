import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildMenuOptions, clonePackages, handleMenuChoice } from './prompt-menu-handlers.js';
import type { RuleOverrides } from './prompt-rules.js';

const { logMock } = vi.hoisted(() => ({
  logMock: { info: vi.fn() },
}));

vi.mock('@clack/prompts', () => ({
  log: logMock,
  note: vi.fn(),
}));

vi.mock('./prompt-submenus.js', () => ({
  promptFileLimitsMenu: vi.fn(),
  promptNamingMenu: vi.fn(),
  promptTestingMenu: vi.fn(),
  FILE_NAMING_OPTIONS: [
    { value: 'kebab-case', label: 'kebab-case' },
    { value: 'camelCase', label: 'camelCase' },
    { value: 'PascalCase', label: 'PascalCase' },
    { value: 'snake_case', label: 'snake_case' },
  ],
}));

vi.mock('./prompt-package-overrides.js', () => ({
  promptPackageOverrides: vi.fn(async (packages: unknown) => packages),
}));

function makeState(overrides: Partial<RuleOverrides> = {}): RuleOverrides {
  return {
    maxFileLines: 300,
    maxTestFileLines: 0,
    testCoverage: 80,
    enforceMissingTests: true,
    enforceNaming: true,
    fileNamingValue: 'kebab-case',
    coverageSummaryPath: 'coverage/coverage-summary.json',
    ...overrides,
  };
}

describe('buildMenuOptions', () => {
  const baseState = makeState();

  it('includes grouped menu options', () => {
    const options = buildMenuOptions(baseState, 0);
    const values = options.map((o) => o.value);
    expect(values).toContain('fileLimits');
    expect(values).toContain('naming');
    expect(values).toContain('testing');
    expect(values).toContain('done');
  });

  it('includes per-package overrides for monorepos', () => {
    const options = buildMenuOptions(baseState, 3);
    const values = options.map((o) => o.value);
    expect(values).toContain('packageOverrides');
  });

  it('hides per-package overrides for single projects', () => {
    const options = buildMenuOptions(baseState, 0);
    const values = options.map((o) => o.value);
    expect(values).not.toContain('packageOverrides');
  });

  it('shows per-package overrides even when coverage is disabled', () => {
    const options = buildMenuOptions({ ...baseState, testCoverage: 0 }, 3);
    const values = options.map((o) => o.value);
    expect(values).toContain('packageOverrides');
  });

  it('shows naming hint as enforced with convention', () => {
    const options = buildMenuOptions(baseState, 0);
    const naming = options.find((o) => o.value === 'naming');
    expect(naming?.hint).toBe('kebab-case (enforced)');
  });

  it('shows naming hint as not enforced', () => {
    const options = buildMenuOptions({ ...baseState, enforceNaming: false }, 0);
    const naming = options.find((o) => o.value === 'naming');
    expect(naming?.hint).toBe('not enforced');
  });

  it('shows naming hint as not set when enforced without value', () => {
    const options = buildMenuOptions(
      { ...baseState, enforceNaming: true, fileNamingValue: undefined },
      0,
    );
    const naming = options.find((o) => o.value === 'naming');
    expect(naming?.hint).toBe('not set (enforced)');
  });

  it('shows file limits hint with test file limit', () => {
    const options = buildMenuOptions({ ...baseState, maxTestFileLines: 500 }, 0);
    const fileLimits = options.find((o) => o.value === 'fileLimits');
    expect(fileLimits?.hint).toBe('max 300 lines, tests 500');
  });

  it('shows file limits hint as unlimited when test limit is 0', () => {
    const options = buildMenuOptions(baseState, 0);
    const fileLimits = options.find((o) => o.value === 'fileLimits');
    expect(fileLimits?.hint).toBe('max 300 lines, test files unlimited');
  });
});

describe('handleMenuChoice', () => {
  beforeEach(() => {
    logMock.info.mockReset();
  });

  it('resets all fields to defaults', async () => {
    const state = makeState({ maxFileLines: 100, testCoverage: 50, fileNamingValue: 'camelCase' });
    const defaults = makeState();
    await handleMenuChoice('reset', state, defaults, undefined);
    expect(state.maxFileLines).toBe(300);
    expect(state.testCoverage).toBe(80);
    expect(state.fileNamingValue).toBe('kebab-case');
    expect(logMock.info).toHaveBeenCalledWith('Reset all rules to detected defaults.');
  });

  it('dispatches to file limits sub-menu', async () => {
    const { promptFileLimitsMenu } = await import('./prompt-submenus.js');
    const state = makeState();
    await handleMenuChoice('fileLimits', state, makeState(), undefined);
    expect(promptFileLimitsMenu).toHaveBeenCalledWith(state);
  });

  it('dispatches to naming sub-menu', async () => {
    const { promptNamingMenu } = await import('./prompt-submenus.js');
    const state = makeState();
    await handleMenuChoice('naming', state, makeState(), undefined);
    expect(promptNamingMenu).toHaveBeenCalledWith(state);
  });

  it('dispatches to testing sub-menu', async () => {
    const { promptTestingMenu } = await import('./prompt-submenus.js');
    const state = makeState();
    await handleMenuChoice('testing', state, makeState(), undefined);
    expect(promptTestingMenu).toHaveBeenCalledWith(state);
  });

  it('dispatches to package overrides', async () => {
    const { promptPackageOverrides } = await import('./prompt-package-overrides.js');
    const packages = [
      { name: 'root', path: '.' },
      { name: 'web', path: 'apps/web' },
    ];
    const state = makeState({ packageOverrides: packages });
    const root = packages[0];
    await handleMenuChoice('packageOverrides', state, makeState(), root);
    expect(promptPackageOverrides).toHaveBeenCalled();
  });
});

describe('clonePackages', () => {
  it('returns undefined for undefined input', () => {
    expect(clonePackages(undefined)).toBeUndefined();
  });

  it('creates deep copies', () => {
    const packages = [{ name: 'test', path: '.', conventions: { fileNaming: 'kebab-case' } }];
    const cloned = clonePackages(packages);
    expect(cloned).toEqual(packages);
    expect(cloned?.[0].conventions).not.toBe(packages[0].conventions);
  });
});
