import { describe, expect, it } from 'vitest';
import { buildMenuOptions, clonePackages } from './prompt-menu-handlers.js';

describe('buildMenuOptions', () => {
  const baseState = {
    maxFileLines: 300,
    testCoverage: 80,
    enforceNaming: true,
    fileNamingValue: 'kebab-case',
    coverageSummaryPath: 'coverage/coverage-summary.json',
    coverageCommand: undefined,
  };

  it('includes all basic options', () => {
    const options = buildMenuOptions(baseState, 0);
    const values = options.map((o) => o.value);
    expect(values).toContain('maxFileLines');
    expect(values).toContain('enforceNaming');
    expect(values).toContain('testCoverage');
    expect(values).toContain('done');
  });

  it('includes coverage options when testCoverage > 0', () => {
    const options = buildMenuOptions(baseState, 0);
    const values = options.map((o) => o.value);
    expect(values).toContain('coverageSummaryPath');
    expect(values).toContain('coverageCommand');
  });

  it('hides coverage options when testCoverage is 0', () => {
    const options = buildMenuOptions({ ...baseState, testCoverage: 0 }, 0);
    const values = options.map((o) => o.value);
    expect(values).not.toContain('coverageSummaryPath');
    expect(values).not.toContain('coverageCommand');
    expect(values).not.toContain('packageOverrides');
  });

  it('includes packageOverrides when packages exist and coverage enabled', () => {
    const options = buildMenuOptions(baseState, 3);
    const values = options.map((o) => o.value);
    expect(values).toContain('packageOverrides');
  });

  it('includes file naming option when fileNamingValue is set', () => {
    const options = buildMenuOptions(baseState, 0);
    const values = options.map((o) => o.value);
    expect(values).toContain('fileNaming');
  });

  it('excludes file naming option when no value detected', () => {
    const options = buildMenuOptions({ ...baseState, fileNamingValue: undefined }, 0);
    const values = options.map((o) => o.value);
    expect(values).not.toContain('fileNaming');
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
