import { describe, expect, it } from 'vitest';
import { initNonInteractive } from './init-non-interactive.js';

describe('initNonInteractive', () => {
  it('is exported as a function', () => {
    expect(typeof initNonInteractive).toBe('function');
  });
});
