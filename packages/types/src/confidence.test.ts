import { describe, expect, it } from 'vitest';
import { confidenceFromConsistency } from './confidence.js';

describe('confidenceFromConsistency', () => {
  it('returns high for 100% consistency', () => {
    expect(confidenceFromConsistency(100)).toBe('high');
  });

  it('returns high for 95% consistency', () => {
    expect(confidenceFromConsistency(95)).toBe('high');
  });

  it('returns high for 90% consistency (boundary)', () => {
    expect(confidenceFromConsistency(90)).toBe('high');
  });

  it('returns medium for 85% consistency', () => {
    expect(confidenceFromConsistency(85)).toBe('medium');
  });

  it('returns medium for 70% consistency (boundary)', () => {
    expect(confidenceFromConsistency(70)).toBe('medium');
  });

  it('returns low for 65% consistency', () => {
    expect(confidenceFromConsistency(65)).toBe('low');
  });

  it('returns low for 0% consistency', () => {
    expect(confidenceFromConsistency(0)).toBe('low');
  });
});
