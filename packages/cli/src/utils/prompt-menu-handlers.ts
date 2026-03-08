import * as clack from '@clack/prompts';
import type { PackageConfig } from '@viberails/types';
import { promptPackageCoverageOverrides } from './prompt-package-overrides.js';
import { assertNotCancelled } from './prompt.js';
import type { RuleOverrides } from './prompt-rules.js';

function getPackageDiffs(pkg: PackageConfig, root: PackageConfig): string[] {
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

/** Build the options list for the rule customization menu. */
export function buildMenuOptions(
  state: RuleOverrides & { packageOverrides?: PackageConfig[] },
  packageCount: number,
): { value: string; label: string; hint?: string }[] {
  const namingHint = state.enforceNaming
    ? `yes${state.fileNamingValue ? ` (${state.fileNamingValue})` : ''}`
    : 'no';

  const options: { value: string; label: string; hint?: string }[] = [
    { value: 'maxFileLines', label: 'Max file lines', hint: String(state.maxFileLines) },
    { value: 'enforceNaming', label: 'Enforce file naming', hint: namingHint },
  ];
  if (state.fileNamingValue) {
    options.push({
      value: 'fileNaming',
      label: 'File naming convention',
      hint: state.fileNamingValue,
    });
  }
  options.push({
    value: 'testCoverage',
    label: 'Test coverage target',
    hint:
      state.testCoverage === 0
        ? '0 (disabled — skips coverage and missing-test checks)'
        : `${state.testCoverage}%`,
  });

  if (state.testCoverage > 0) {
    options.push(
      {
        value: 'coverageSummaryPath',
        label: 'Coverage summary path',
        hint: state.coverageSummaryPath,
      },
      {
        value: 'coverageCommand',
        label: 'Coverage command',
        hint: state.coverageCommand ?? 'auto-detect from package.json test runner',
      },
    );

    if (packageCount > 0) {
      options.push({
        value: 'packageOverrides',
        label: 'Per-package coverage overrides',
        hint: `${packageCount} package${packageCount > 1 ? 's' : ''} configurable`,
      });
    }
  }

  options.push(
    { value: 'reset', label: 'Reset all to detected defaults' },
    { value: 'done', label: 'Done' },
  );

  return options;
}

export function clonePackages(packages?: PackageConfig[]): PackageConfig[] | undefined {
  return packages?.map((pkg) => ({
    ...pkg,
    stack: pkg.stack ? { ...pkg.stack } : undefined,
    structure: pkg.structure ? { ...pkg.structure } : undefined,
    conventions: pkg.conventions ? { ...pkg.conventions } : undefined,
    rules: pkg.rules ? { ...pkg.rules } : undefined,
    coverage: pkg.coverage ? { ...pkg.coverage } : undefined,
    ignore: pkg.ignore ? [...pkg.ignore] : undefined,
    boundaries: pkg.boundaries
      ? {
          deny: [...pkg.boundaries.deny],
          ignore: pkg.boundaries.ignore ? [...pkg.boundaries.ignore] : undefined,
        }
      : undefined,
  }));
}

/** Handle a single menu choice and update state accordingly. */
export async function handleMenuChoice(
  choice: string,
  state: RuleOverrides & { packageOverrides?: PackageConfig[] },
  defaults: RuleOverrides & { packageOverrides?: PackageConfig[] },
  root: PackageConfig | undefined,
): Promise<void> {
  if (choice === 'reset') {
    state.maxFileLines = defaults.maxFileLines;
    state.testCoverage = defaults.testCoverage;
    state.enforceNaming = defaults.enforceNaming;
    state.fileNamingValue = defaults.fileNamingValue;
    state.coverageSummaryPath = defaults.coverageSummaryPath;
    state.coverageCommand = defaults.coverageCommand;
    state.packageOverrides = clonePackages(defaults.packageOverrides);
    clack.log.info('Reset all rules to detected defaults.');
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
      state.packageOverrides = await promptPackageCoverageOverrides(state.packageOverrides, {
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

  if (choice === 'maxFileLines') {
    const result = await clack.text({
      message: 'Maximum lines per source file?',
      initialValue: String(state.maxFileLines),
      validate: (v) => {
        if (typeof v !== 'string') return 'Enter a positive number';
        const n = Number.parseInt(v, 10);
        if (Number.isNaN(n) || n < 1) return 'Enter a positive number';
      },
    });
    assertNotCancelled(result);
    state.maxFileLines = Number.parseInt(result, 10);
  }

  if (choice === 'testCoverage') {
    const result = await clack.text({
      message: 'Test coverage target (0 disables both coverage and missing-test checks)?',
      initialValue: String(state.testCoverage),
      validate: (v) => {
        if (typeof v !== 'string') return 'Enter a number between 0 and 100';
        const n = Number.parseInt(v, 10);
        if (Number.isNaN(n) || n < 0 || n > 100) return 'Enter a number between 0 and 100';
      },
    });
    assertNotCancelled(result);
    state.testCoverage = Number.parseInt(result, 10);
  }

  if (choice === 'coverageSummaryPath') {
    const result = await clack.text({
      message: 'Coverage summary path (relative to package root)?',
      initialValue: state.coverageSummaryPath,
      validate: (v) => {
        if (typeof v !== 'string' || v.trim().length === 0) return 'Path cannot be empty';
      },
    });
    assertNotCancelled(result);
    state.coverageSummaryPath = result.trim();
  }

  if (choice === 'coverageCommand') {
    const result = await clack.text({
      message: 'Coverage command (blank to auto-detect from package.json)?',
      initialValue: state.coverageCommand ?? '',
      placeholder: '(auto-detect from package.json test runner)',
    });
    assertNotCancelled(result);
    const trimmed = result.trim();
    state.coverageCommand = trimmed.length > 0 ? trimmed : undefined;
  }

  if (choice === 'enforceNaming') {
    const result = await clack.confirm({
      message: state.fileNamingValue
        ? `Enforce file naming? (detected: ${state.fileNamingValue})`
        : 'Enforce file naming?',
      initialValue: state.enforceNaming,
    });
    assertNotCancelled(result);
    state.enforceNaming = result;
  }

  if (choice === 'fileNaming') {
    const selected = await clack.select({
      message: 'Which file naming convention should be enforced?',
      options: [
        { value: 'kebab-case', label: 'kebab-case' },
        { value: 'camelCase', label: 'camelCase' },
        { value: 'PascalCase', label: 'PascalCase' },
        { value: 'snake_case', label: 'snake_case' },
      ],
      initialValue: state.fileNamingValue,
    });
    assertNotCancelled(selected);
    state.fileNamingValue = selected;
  }
}
