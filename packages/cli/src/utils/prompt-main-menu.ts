import * as clack from '@clack/prompts';
import type { ScanResult, ViberailsConfig } from '@viberails/types';
import { formatScanResultsText } from '../display-text.js';
import type { PrereqResult } from './check-prerequisites.js';
import type { DeferredInstall } from './deferred-install.js';
import { getRootPackage } from './get-root-package.js';
import { assertNotCancelled } from './prompt.js';
import type { DetectedTools, IntegrationChoice } from './prompt-integrations.js';
import {
  handleAdvancedNaming,
  handleBoundaries,
  handleCoverage,
  handleFileNaming,
  handleIntegrations,
  handleMissingTests,
  handlePackageOverrides,
} from './prompt-main-menu-handlers.js';
import { buildMainMenuOptions } from './prompt-main-menu-hints.js';
import { promptFileLimitsMenu } from './prompt-submenus.js';

export interface InitMenuState {
  visited: { integrations: boolean; boundaries: boolean };
  deferredInstalls: DeferredInstall[];
  integrations?: IntegrationChoice;
  hasTestRunner: boolean;
  hookManager: string | undefined;
}

interface MainMenuOpts {
  hasTestRunner: boolean;
  hookManager: string | undefined;
  coveragePrereqs: PrereqResult[];
  projectRoot: string;
  tools: DetectedTools;
}

/**
 * Run the interactive main menu loop for init.
 * Mutates the draft config in place. Returns when user selects Done.
 */
export async function promptMainMenu(
  config: ViberailsConfig,
  scanResult: ScanResult,
  opts: MainMenuOpts,
): Promise<InitMenuState> {
  const originalConfig = structuredClone(config);
  const state: InitMenuState = {
    visited: { integrations: false, boundaries: false },
    deferredInstalls: [],
    hasTestRunner: opts.hasTestRunner,
    hookManager: opts.hookManager,
  };

  while (true) {
    const options = buildMainMenuOptions(config, scanResult, state);
    const choice = await clack.select({ message: 'Configure viberails', options });
    assertNotCancelled(choice);

    if (choice === 'done') {
      if (config.rules.enforceNaming && !getRootPackage(config.packages).conventions?.fileNaming) {
        config.rules.enforceNaming = false;
      }
      break;
    }

    if (choice === 'fileLimits') {
      const s = {
        maxFileLines: config.rules.maxFileLines,
        maxTestFileLines: config.rules.maxTestFileLines,
      };
      await promptFileLimitsMenu(s);
      config.rules.maxFileLines = s.maxFileLines;
      config.rules.maxTestFileLines = s.maxTestFileLines;
    }
    if (choice === 'fileNaming') await handleFileNaming(config, scanResult);
    if (choice === 'missingTests') await handleMissingTests(config);
    if (choice === 'coverage') await handleCoverage(config, state, opts);
    if (choice === 'advancedNaming') await handleAdvancedNaming(config);
    if (choice === 'packageOverrides') await handlePackageOverrides(config);
    if (choice === 'boundaries') await handleBoundaries(config, state, opts);
    if (choice === 'integrations') await handleIntegrations(state, opts);
    if (choice === 'review') clack.note(formatScanResultsText(scanResult), 'Scan details');
    if (choice === 'reset') {
      const confirmed = await clack.confirm({
        message: 'Reset all settings to scan-detected defaults?',
        initialValue: false,
      });
      assertNotCancelled(confirmed);
      if (confirmed) {
        Object.assign(config, structuredClone(originalConfig));
        state.deferredInstalls = [];
        state.visited = { integrations: false, boundaries: false };
        state.integrations = undefined;
        clack.log.info('Reset all settings to scan-detected defaults.');
      }
    }
  }

  return state;
}
