import { describe, expect, it } from 'vitest';
import type { InitMenuState, MainMenuOpts } from './prompt-main-menu-types.js';

describe('prompt-main-menu-types', () => {
  it('InitMenuState satisfies expected shape', () => {
    const state: InitMenuState = {
      visited: { integrations: false, boundaries: false },
      deferredInstalls: [],
      hasTestRunner: true,
      hookManager: undefined,
    };
    expect(state.visited.integrations).toBe(false);
  });

  it('MainMenuOpts satisfies expected shape', () => {
    const opts: MainMenuOpts = {
      hasTestRunner: true,
      hookManager: undefined,
      coveragePrereqs: [],
      projectRoot: '/test',
      tools: { packageManager: 'pnpm' },
    };
    expect(opts.projectRoot).toBe('/test');
  });
});
