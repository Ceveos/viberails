import * as clack from '@clack/prompts';
import type { PackageConfig } from '@viberails/types';
import { getRootPackage } from './get-root-package.js';
import { assertNotCancelled } from './prompt.js';
import { buildMenuOptions, clonePackages, handleMenuChoice } from './prompt-menu-handlers.js';

export interface RuleOverrides {
  maxFileLines: number;
  maxTestFileLines: number;
  testCoverage: number;
  enforceMissingTests: boolean;
  enforceNaming: boolean;
  fileNamingValue?: string;
  componentNaming?: string;
  hookNaming?: string;
  importAlias?: string;
  coverageSummaryPath: string;
  coverageCommand?: string;
  packageOverrides?: PackageConfig[];
}

/**
 * Menu-based rule customization. Displays rules grouped into basic and
 * advanced sections. User browses with arrow keys and presses enter to
 * edit a rule, then returns to the menu. Select "Done" to finish.
 *
 * @param defaults - Current detected/default values to pre-fill
 * @returns The user's chosen rule settings
 */
export async function promptRuleMenu(defaults: {
  maxFileLines: number;
  maxTestFileLines: number;
  testCoverage: number;
  enforceMissingTests: boolean;
  enforceNaming: boolean;
  fileNamingValue?: string;
  componentNaming?: string;
  hookNaming?: string;
  importAlias?: string;
  coverageSummaryPath: string;
  coverageCommand?: string;
  packageOverrides?: PackageConfig[];
}): Promise<RuleOverrides> {
  const state: RuleOverrides = {
    ...defaults,
    packageOverrides: clonePackages(defaults.packageOverrides),
  };
  const root =
    state.packageOverrides && state.packageOverrides.length > 0
      ? getRootPackage(state.packageOverrides)
      : undefined;
  const packageCount = state.packageOverrides?.filter((pkg) => pkg.path !== '.').length ?? 0;

  while (true) {
    const options = buildMenuOptions(state, packageCount);
    const choice = await clack.select({ message: 'Customize rules', options });
    assertNotCancelled(choice);

    if (choice === 'done') break;
    await handleMenuChoice(choice, state, defaults, root);
  }

  return {
    maxFileLines: state.maxFileLines,
    maxTestFileLines: state.maxTestFileLines,
    testCoverage: state.testCoverage,
    enforceMissingTests: state.enforceMissingTests,
    enforceNaming: state.enforceNaming,
    fileNamingValue: state.fileNamingValue,
    componentNaming: state.componentNaming,
    hookNaming: state.hookNaming,
    importAlias: state.importAlias,
    coverageSummaryPath: state.coverageSummaryPath,
    coverageCommand: state.coverageCommand,
    packageOverrides: state.packageOverrides,
  };
}
