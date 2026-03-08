import { describe, expect, it } from 'vitest';
import { BUILTIN_IGNORE, DEFAULT_IGNORE, DEFAULT_RULES } from './defaults.js';

describe('DEFAULT_RULES', () => {
  it('has expected shape', () => {
    expect(DEFAULT_RULES.maxFileLines).toBe(300);
    expect(DEFAULT_RULES.maxTestFileLines).toBe(0);
    expect(DEFAULT_RULES.testCoverage).toBe(80);
    expect(DEFAULT_RULES.enforceNaming).toBe(true);
    expect(DEFAULT_RULES.enforceBoundaries).toBe(false);
  });
});

describe('DEFAULT_IGNORE', () => {
  it('is an empty array', () => {
    expect(DEFAULT_IGNORE).toEqual([]);
  });
});

describe('BUILTIN_IGNORE', () => {
  it('includes common build directories', () => {
    expect(BUILTIN_IGNORE).toContain('dist/**');
    expect(BUILTIN_IGNORE).toContain('node_modules/**');
  });

  it('includes declaration files', () => {
    expect(BUILTIN_IGNORE).toContain('**/*.d.ts');
  });
});
