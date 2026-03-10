import { describe, expect, it } from 'vitest';
import { buildMenuOptions, clonePackages } from './prompt-menu-handlers.js';

describe('buildMenuOptions', () => {
  const baseState = {
    maxFileLines: 300,
    maxTestFileLines: 0,
    testCoverage: 80,
    enforceMissingTests: true,
    enforceNaming: true,
    fileNamingValue: 'kebab-case',
    coverageSummaryPath: 'coverage/coverage-summary.json',
    coverageCommand: undefined,
  };

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
