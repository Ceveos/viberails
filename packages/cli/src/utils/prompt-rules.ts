import * as clack from '@clack/prompts';
import type { PackageConfig } from '@viberails/types';
import { assertNotCancelled } from './prompt.js';
import { buildMenuOptions, clonePackages, handleMenuChoice } from './prompt-menu-handlers.js';

export interface RuleOverrides {
  maxFileLines: number;
  testCoverage: number;
  enforceMissingTests: boolean;
  enforceNaming: boolean;
  fileNamingValue?: string;
  coverageSummaryPath: string;
  coverageCommand?: string;
  packageOverrides?: PackageConfig[];
}

function getRootPackage(packages: PackageConfig[]): PackageConfig {
  return packages.find((pkg) => pkg.path === '.') ?? packages[0];
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
  testCoverage: number;
  enforceMissingTests: boolean;
  enforceNaming: boolean;
  fileNamingValue?: string;
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
    testCoverage: state.testCoverage,
    enforceMissingTests: state.enforceMissingTests,
    enforceNaming: state.enforceNaming,
    fileNamingValue: state.fileNamingValue,
    coverageSummaryPath: state.coverageSummaryPath,
    coverageCommand: state.coverageCommand,
    packageOverrides: state.packageOverrides,
  };
}
