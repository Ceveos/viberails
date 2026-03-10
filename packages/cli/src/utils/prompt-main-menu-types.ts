import type { PrereqResult } from './check-prerequisites.js';
import type { DeferredInstall } from './deferred-install.js';
import type { DetectedTools, IntegrationChoice } from './prompt-integrations.js';

export interface InitMenuState {
  visited: { integrations: boolean; boundaries: boolean };
  deferredInstalls: DeferredInstall[];
  integrations?: IntegrationChoice;
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
