import * as clack from '@clack/prompts';
import type { PackageConfig } from '@viberails/types';
import { promptPackageOverrides } from './prompt-package-overrides.js';
import type { RuleOverrides } from './prompt-rules.js';
import { promptFileLimitsMenu, promptNamingMenu, promptTestingMenu } from './prompt-submenus.js';

/** @internal Exported for testing. */
export function getPackageDiffs(pkg: PackageConfig, root: PackageConfig): string[] {
  const diffs: string[] = [];

  const convKeys = ['fileNaming', 'componentNaming', 'hookNaming', 'importAlias'] as const;
  for (const key of convKeys) {
    if (pkg.conventions?.[key] && pkg.conventions[key] !== root.conventions?.[key]) {
      diffs.push(`${key}: ${pkg.conventions[key]}`);
    }
  }

  const stackKeys = [
    'framework',
    'language',
    'styling',
    'backend',
    'orm',
    'linter',
    'formatter',
    'testRunner',
    'packageManager',
  ] as const;
  for (const key of stackKeys) {
    if (pkg.stack?.[key] && pkg.stack[key] !== root.stack?.[key]) {
      diffs.push(`${key}: ${pkg.stack[key]}`);
    }
  }

  if (
    pkg.rules?.maxFileLines !== undefined &&
    pkg.rules.maxFileLines !== root.rules?.maxFileLines &&
    pkg.rules.maxFileLines > 0
  ) {
    diffs.push(`maxFileLines: ${pkg.rules.maxFileLines}`);
  }
  if (
    pkg.rules?.testCoverage !== undefined &&
    pkg.rules.testCoverage !== root.rules?.testCoverage &&
    pkg.rules.testCoverage >= 0
  ) {
    diffs.push(`testCoverage: ${pkg.rules.testCoverage}`);
  }
  if (pkg.coverage?.summaryPath && pkg.coverage.summaryPath !== root.coverage?.summaryPath) {
    diffs.push(`coverage.summaryPath: ${pkg.coverage.summaryPath}`);
  }
  if (pkg.coverage?.command && pkg.coverage.command !== root.coverage?.command) {
    diffs.push('coverage.command: (override)');
  }

  return diffs;
}

/** Build the top-level grouped options for the rule customization menu. */
export function buildMenuOptions(
  state: RuleOverrides,
  packageCount: number,
): { value: string; label: string; hint?: string }[] {
  const fileLimitsHint =
    state.maxTestFileLines > 0
      ? `max ${state.maxFileLines} lines, tests ${state.maxTestFileLines}`
      : `max ${state.maxFileLines} lines, test files unlimited`;

  const namingHint = state.enforceNaming
    ? `${state.fileNamingValue ?? 'not set'} (enforced)`
    : 'not enforced';

  const testingHint =
    state.testCoverage > 0
      ? `${state.testCoverage}% coverage, missing tests ${state.enforceMissingTests ? 'enforced' : 'not enforced'}`
      : `coverage disabled, missing tests ${state.enforceMissingTests ? 'enforced' : 'not enforced'}`;

  const options: { value: string; label: string; hint?: string }[] = [
    { value: 'fileLimits', label: 'File limits', hint: fileLimitsHint },
    { value: 'naming', label: 'Naming & conventions', hint: namingHint },
    { value: 'testing', label: 'Testing & coverage', hint: testingHint },
  ];

  if (packageCount > 0) {
    options.push({
      value: 'packageOverrides',
      label: 'Per-package overrides',
      hint: `${packageCount} package${packageCount > 1 ? 's' : ''} configurable`,
    });
  }

  options.push(
    { value: 'reset', label: 'Reset all to detected defaults' },
    { value: 'done', label: 'Done' },
  );

  return options;
}

export function clonePackages(packages?: PackageConfig[]): PackageConfig[] | undefined {
  return packages ? structuredClone(packages) : undefined;
}

/** Handle a single top-level menu choice and update state accordingly. */
export async function handleMenuChoice(
  choice: string,
  state: RuleOverrides,
  defaults: RuleOverrides,
  root: PackageConfig | undefined,
): Promise<void> {
  if (choice === 'reset') {
    state.maxFileLines = defaults.maxFileLines;
    state.maxTestFileLines = defaults.maxTestFileLines;
    state.testCoverage = defaults.testCoverage;
    state.enforceMissingTests = defaults.enforceMissingTests;
    state.enforceNaming = defaults.enforceNaming;
    state.fileNamingValue = defaults.fileNamingValue;
    state.componentNaming = defaults.componentNaming;
    state.hookNaming = defaults.hookNaming;
    state.importAlias = defaults.importAlias;
    state.coverageSummaryPath = defaults.coverageSummaryPath;
    state.coverageCommand = defaults.coverageCommand;
    state.packageOverrides = clonePackages(defaults.packageOverrides);
    clack.log.info('Reset all rules to detected defaults.');
    return;
  }

  if (choice === 'fileLimits') {
    await promptFileLimitsMenu(state);
    return;
  }

  if (choice === 'naming') {
    await promptNamingMenu(state);
    return;
  }

  if (choice === 'testing') {
    await promptTestingMenu(state);
    return;
  }

  if (choice === 'packageOverrides') {
    if (state.packageOverrides) {
      const packageDiffs = root
        ? state.packageOverrides
            .filter((pkg) => pkg.path !== root.path)
            .map((pkg) => ({ pkg, diffs: getPackageDiffs(pkg, root) }))
            .filter((entry) => entry.diffs.length > 0)
        : [];
      state.packageOverrides = await promptPackageOverrides(state.packageOverrides, {
        fileNamingValue: state.fileNamingValue,
        maxFileLines: state.maxFileLines,
        testCoverage: state.testCoverage,
        coverageSummaryPath: state.coverageSummaryPath,
        coverageCommand: state.coverageCommand,
      });
      const lines = packageDiffs.map((entry) => `${entry.pkg.path}\n  ${entry.diffs.join(', ')}`);
      if (lines.length > 0) {
        clack.note(lines.join('\n\n'), 'Existing package differences');
      }
    }
    return;
  }
}
