import * as clack from '@clack/prompts';
import type { ScanResult, ViberailsConfig } from '@viberails/types';
import { formatScanResultsText } from '../display-text.js';
import { getRootPackage } from './get-root-package.js';
import { assertNotCancelled } from './prompt.js';
import {
  handleAiContext,
  handleBoundaries,
  handleCoverage,
  handleFileNaming,
  handleMissingTests,
  handlePackageOverrides,
} from './prompt-main-menu-handlers.js';
import { buildMainMenuOptions } from './prompt-main-menu-hints.js';
import type { InitMenuState, MainMenuOpts } from './prompt-main-menu-types.js';
import { promptFileLimitsMenu } from './prompt-submenus.js';

export type { InitMenuState, MainMenuOpts } from './prompt-main-menu-types.js';

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
    visited: { boundaries: false },
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
    if (choice === 'aiContext') await handleAiContext(config);
    if (choice === 'packageOverrides') await handlePackageOverrides(config);
    if (choice === 'boundaries') await handleBoundaries(config, state, opts);
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
        state.visited = { boundaries: false };
        clack.log.info('Reset all settings to scan-detected defaults.');
      }
    }
  }

  return state;
}
