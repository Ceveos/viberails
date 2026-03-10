import { describe, expect, it } from 'vitest';
import {
  SENTINEL_CLEAR,
  SENTINEL_CUSTOM,
  SENTINEL_DONE,
  SENTINEL_INHERIT,
  SENTINEL_NONE,
  SENTINEL_SKIP,
} from './prompt-constants.js';

describe('prompt-constants', () => {
  it('exports all sentinel values as unique strings', () => {
    const values = [
      SENTINEL_DONE,
      SENTINEL_CLEAR,
      SENTINEL_CUSTOM,
      SENTINEL_NONE,
      SENTINEL_INHERIT,
      SENTINEL_SKIP,
    ];
    expect(new Set(values).size).toBe(values.length);
    for (const v of values) {
      expect(typeof v).toBe('string');
      expect(v.startsWith('__')).toBe(true);
    }
  });
});
