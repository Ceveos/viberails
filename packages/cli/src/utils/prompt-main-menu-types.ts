import type { PrereqResult } from './check-prerequisites.js';
import type { DeferredInstall } from './deferred-install.js';
import type { DetectedTools } from './prompt-integrations.js';

export interface InitMenuState {
  visited: { boundaries: boolean };
  deferredInstalls: DeferredInstall[];
  hasTestRunner: boolean;
  hookManager: string | undefined;
}

export interface MainMenuOpts {
  hasTestRunner: boolean;
  hookManager: string | undefined;
  coveragePrereqs: PrereqResult[];
  projectRoot: string;
  tools: DetectedTools;
}
