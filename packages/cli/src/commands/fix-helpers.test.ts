import { describe, expect, it } from 'vitest';
import { checkGitDirty, getConventionValue } from './fix-helpers.js';

describe('getConventionValue', () => {
  it('returns a string value as-is', () => {
    expect(getConventionValue('kebab-case')).toBe('kebab-case');
  });

  it('returns undefined for non-string values', () => {
    expect(getConventionValue(undefined)).toBeUndefined();
    expect(getConventionValue(42)).toBeUndefined();
    expect(getConventionValue(null)).toBeUndefined();
  });
});

describe('checkGitDirty', () => {
  it('returns a boolean', () => {
    const result = checkGitDirty(process.cwd());
    expect(typeof result).toBe('boolean');
  });

  it('returns false for a non-existent directory', () => {
    expect(checkGitDirty('/nonexistent/path')).toBe(false);
  });
});
