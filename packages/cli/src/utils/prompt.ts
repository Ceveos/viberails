import * as clack from '@clack/prompts';
import type { PackageConfig } from '@viberails/types';

/**
 * Assert that a clack prompt result was not cancelled (Ctrl+C).
 * If cancelled, prints a message and exits the process.
 */
function assertNotCancelled<T>(value: T | symbol): asserts value is T {
  if (clack.isCancel(value)) {
    clack.cancel('Setup cancelled.');
    process.exit(0);
  }
}

/**
 * Prompt the user for a yes/no confirmation.
 *
 * @param message - The question to display
 * @returns true if the user confirms, false otherwise
 */
export async function confirm(message: string): Promise<boolean> {
  const result = await clack.confirm({ message, initialValue: true });
  assertNotCancelled(result);
  return result;
}

/**
 * Prompt the user for a yes/no confirmation that defaults to NO.
 * Use for destructive or risky actions.
 *
 * @param message - The question to display
 * @returns true if the user confirms, false otherwise
 */
export async function confirmDangerous(message: string): Promise<boolean> {
  const result = await clack.confirm({ message, initialValue: false });
  assertNotCancelled(result);
  return result;
}

export interface IntegrationChoice {
  preCommitHook: boolean;
  claudeCodeHook: boolean;
  claudeMdRef: boolean;
}

/**
 * Prompt the user to choose between accepting defaults or customizing.
 *
 * @returns 'accept' or 'customize'
 */
export async function promptInitDecision(): Promise<'accept' | 'customize'> {
  const result = await clack.select({
    message: 'Accept these settings?',
    options: [
      { value: 'accept' as const, label: 'Yes, looks good', hint: 'recommended' },
      { value: 'customize' as const, label: 'Let me customize' },
    ],
  });
  assertNotCancelled(result);
  return result;
}

export interface RuleOverrides {
  maxFileLines: number;
  testCoverage: number;
  enforceNaming: boolean;
  fileNamingValue?: string;
  coverageSummaryPath: string;
  coverageCommand?: string;
  packageOverrides?: PackageConfig[];
}

function getRootPackage(packages: PackageConfig[]): PackageConfig {
  return packages.find((pkg) => pkg.path === '.') ?? packages[0];
}

function getPackageDiffs(pkg: PackageConfig, root: PackageConfig): string[] {
  const diffs: string[] = [];

  if (pkg.conventions?.fileNaming && pkg.conventions.fileNaming !== root.conventions?.fileNaming) {
    diffs.push(`fileNaming: ${pkg.conventions.fileNaming}`);
  }
  if (
    pkg.conventions?.componentNaming &&
    pkg.conventions.componentNaming !== root.conventions?.componentNaming
  ) {
    diffs.push(`componentNaming: ${pkg.conventions.componentNaming}`);
  }
  if (pkg.conventions?.hookNaming && pkg.conventions.hookNaming !== root.conventions?.hookNaming) {
    diffs.push(`hookNaming: ${pkg.conventions.hookNaming}`);
  }
  if (
    pkg.conventions?.importAlias &&
    pkg.conventions.importAlias !== root.conventions?.importAlias
  ) {
    diffs.push(`importAlias: ${pkg.conventions.importAlias}`);
  }

  if (pkg.stack?.framework && pkg.stack.framework !== root.stack?.framework) {
    diffs.push(`framework: ${pkg.stack.framework}`);
  }
  if (pkg.stack?.language && pkg.stack.language !== root.stack?.language) {
    diffs.push(`language: ${pkg.stack.language}`);
  }
  if (pkg.stack?.styling && pkg.stack.styling !== root.stack?.styling) {
    diffs.push(`styling: ${pkg.stack.styling}`);
  }
  if (pkg.stack?.backend && pkg.stack.backend !== root.stack?.backend) {
    diffs.push(`backend: ${pkg.stack.backend}`);
  }
  if (pkg.stack?.orm && pkg.stack.orm !== root.stack?.orm) {
    diffs.push(`orm: ${pkg.stack.orm}`);
  }
  if (pkg.stack?.linter && pkg.stack.linter !== root.stack?.linter) {
    diffs.push(`linter: ${pkg.stack.linter}`);
  }
  if (pkg.stack?.formatter && pkg.stack.formatter !== root.stack?.formatter) {
    diffs.push(`formatter: ${pkg.stack.formatter}`);
  }
  if (pkg.stack?.testRunner && pkg.stack.testRunner !== root.stack?.testRunner) {
    diffs.push(`testRunner: ${pkg.stack.testRunner}`);
  }
  if (pkg.stack?.packageManager && pkg.stack.packageManager !== root.stack?.packageManager) {
    diffs.push(`packageManager: ${pkg.stack.packageManager}`);
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

function normalizePackageOverrides(packages: PackageConfig[]): PackageConfig[] {
  for (const pkg of packages) {
    if (pkg.rules && Object.keys(pkg.rules).length === 0) {
      delete pkg.rules;
    }
    if (pkg.coverage && Object.keys(pkg.coverage).length === 0) {
      delete pkg.coverage;
    }
  }
  return packages;
}

function packageCoverageHint(
  pkg: PackageConfig,
  defaults: { testCoverage: number; coverageSummaryPath: string; coverageCommand?: string },
): string {
  const coverage = pkg.rules?.testCoverage ?? defaults.testCoverage;
  const isExempt = coverage === 0;
  const hasSummaryOverride =
    pkg.coverage?.summaryPath !== undefined &&
    pkg.coverage.summaryPath !== defaults.coverageSummaryPath;
  const defaultCommand = defaults.coverageCommand ?? '';
  const hasCommandOverride =
    pkg.coverage?.command !== undefined && pkg.coverage.command !== defaultCommand;

  const tags: string[] = [];
  tags.push(isExempt ? 'exempt' : `${coverage}%`);
  if (hasSummaryOverride) tags.push('summary override');
  if (hasCommandOverride) tags.push('command override');
  return tags.join(', ');
}

async function promptPackageCoverageOverrides(
  packages: PackageConfig[],
  defaults: { testCoverage: number; coverageSummaryPath: string; coverageCommand?: string },
): Promise<PackageConfig[]> {
  const editablePackages = packages.filter((pkg) => pkg.path !== '.');
  if (editablePackages.length === 0) return packages;

  while (true) {
    const selectedPath = await clack.select({
      message: 'Select package to edit coverage overrides',
      options: [
        ...editablePackages.map((pkg) => ({
          value: pkg.path,
          label: `${pkg.path} (${pkg.name})`,
          hint: packageCoverageHint(pkg, defaults),
        })),
        { value: '__done__', label: 'Done' },
      ],
    });
    assertNotCancelled(selectedPath);
    if (selectedPath === '__done__') break;

    const target = editablePackages.find((pkg) => pkg.path === selectedPath);
    if (!target) continue;

    while (true) {
      const effectiveCoverage = target.rules?.testCoverage ?? defaults.testCoverage;
      const effectiveSummary = target.coverage?.summaryPath ?? defaults.coverageSummaryPath;
      const effectiveCommand =
        target.coverage?.command ?? defaults.coverageCommand ?? '(auto-detect)';

      const choice = await clack.select({
        message: `Edit coverage overrides for ${target.path}`,
        options: [
          { value: 'testCoverage', label: 'testCoverage', hint: String(effectiveCoverage) },
          { value: 'summaryPath', label: 'coverage.summaryPath', hint: effectiveSummary },
          { value: 'command', label: 'coverage.command', hint: effectiveCommand },
          { value: 'reset', label: 'Reset this package to inherit defaults' },
          { value: 'back', label: 'Back to package list' },
        ],
      });
      assertNotCancelled(choice);

      if (choice === 'back') break;

      if (choice === 'testCoverage') {
        const result = await clack.text({
          message: 'Package testCoverage (0 to exempt package)?',
          initialValue: String(effectiveCoverage),
          validate: (v) => {
            if (typeof v !== 'string') return 'Enter a number between 0 and 100';
            const n = Number.parseInt(v, 10);
            if (Number.isNaN(n) || n < 0 || n > 100) return 'Enter a number between 0 and 100';
          },
        });
        assertNotCancelled(result);
        const nextCoverage = Number.parseInt(result, 10);
        if (nextCoverage === defaults.testCoverage) {
          if (target.rules) {
            delete target.rules.testCoverage;
          }
        } else {
          target.rules = { ...(target.rules ?? {}), testCoverage: nextCoverage };
        }
      }

      if (choice === 'summaryPath') {
        const result = await clack.text({
          message: 'Package coverage.summaryPath (blank to inherit default)?',
          initialValue:
            target.coverage?.summaryPath !== undefined ? target.coverage.summaryPath : '',
          placeholder: defaults.coverageSummaryPath,
        });
        assertNotCancelled(result);
        const value = result.trim();
        if (value.length === 0 || value === defaults.coverageSummaryPath) {
          if (target.coverage) {
            delete target.coverage.summaryPath;
          }
        } else {
          target.coverage = { ...(target.coverage ?? {}), summaryPath: value };
        }
      }

      if (choice === 'command') {
        const result = await clack.text({
          message: 'Package coverage.command (blank to inherit default/auto)?',
          initialValue: target.coverage?.command !== undefined ? target.coverage.command : '',
          placeholder: defaults.coverageCommand ?? '(auto-detect local Vitest/Jest)',
        });
        assertNotCancelled(result);
        const value = result.trim();
        const defaultCommand = defaults.coverageCommand ?? '';
        if (value.length === 0 || value === defaultCommand) {
          if (target.coverage) {
            delete target.coverage.command;
          }
        } else {
          target.coverage = { ...(target.coverage ?? {}), command: value };
        }
      }

      if (choice === 'reset') {
        if (target.rules) {
          delete target.rules.testCoverage;
        }
        delete target.coverage;
      }

      normalizePackageOverrides(editablePackages);
    }
  }

  return normalizePackageOverrides(packages);
}

/**
 * Menu-based rule customization. Displays all rules with current values
 * as hints. User browses with arrow keys and presses enter to edit a rule,
 * then returns to the menu. Select "Done" to finish.
 *
 * @param defaults - Current detected/default values to pre-fill
 * @returns The user's chosen rule settings
 */
export async function promptRuleMenu(defaults: {
  maxFileLines: number;
  testCoverage: number;
  enforceNaming: boolean;
  fileNamingValue?: string;
  coverageSummaryPath: string;
  coverageCommand?: string;
  packageOverrides?: PackageConfig[];
}): Promise<RuleOverrides> {
  const state = {
    ...defaults,
    packageOverrides: defaults.packageOverrides?.map((pkg) => ({
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
    })),
  };
  const root =
    state.packageOverrides && state.packageOverrides.length > 0
      ? getRootPackage(state.packageOverrides)
      : undefined;
  const packageCount = state.packageOverrides?.filter((pkg) => pkg.path !== '.').length ?? 0;

  while (true) {
    const packageDiffs =
      root && state.packageOverrides
        ? state.packageOverrides
            .filter((pkg) => pkg.path !== root.path)
            .map((pkg) => ({ pkg, diffs: getPackageDiffs(pkg, root) }))
            .filter((entry) => entry.diffs.length > 0)
        : [];
    const namingHint = state.enforceNaming
      ? `yes${state.fileNamingValue ? ` (${state.fileNamingValue})` : ''}`
      : 'no';

    const options: { value: string; label: string; hint?: string }[] = [
      { value: 'maxFileLines', label: 'Max file lines', hint: String(state.maxFileLines) },
      {
        value: 'testCoverage',
        label: 'Test coverage target / missing-test gate',
        hint: `${state.testCoverage}%`,
      },
      {
        value: 'coverageSummaryPath',
        label: 'Coverage summary path',
        hint: state.coverageSummaryPath,
      },
      {
        value: 'coverageCommand',
        label: 'Coverage command (optional)',
        hint: state.coverageCommand ?? 'auto-detect local Vitest/Jest',
      },
      { value: 'enforceNaming', label: 'Enforce file naming', hint: namingHint },
    ];
    if (state.fileNamingValue) {
      options.push({
        value: 'fileNaming',
        label: 'File naming convention',
        hint: state.fileNamingValue,
      });
    }

    if (packageCount > 0) {
      const count = packageCount;
      options.push({
        value: 'packageOverrides',
        label: 'Per-package coverage overrides',
        hint: `${count} package${count > 1 ? 's' : ''} configurable`,
      });
    }

    options.push({ value: 'done', label: 'Done' });

    const choice = await clack.select({
      message: 'Customize rules',
      options,
    });
    assertNotCancelled(choice);

    if (choice === 'done') break;

    if (choice === 'packageOverrides') {
      if (state.packageOverrides) {
        state.packageOverrides = await promptPackageCoverageOverrides(state.packageOverrides, {
          testCoverage: state.testCoverage,
          coverageSummaryPath: state.coverageSummaryPath,
          coverageCommand: state.coverageCommand,
        });
      }
      const lines = packageDiffs.map((entry) => `${entry.pkg.path}\n  ${entry.diffs.join(', ')}`);
      if (lines.length > 0) {
        clack.note(lines.join('\n\n'), 'Existing package differences');
      }
      continue;
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
        message: 'Test coverage target (0 disables both coverage + missing-test checks)?',
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
        message: 'Coverage command (optional, blank = local runner auto-detect)?',
        initialValue: state.coverageCommand ?? '',
        placeholder: '(auto-detect local Vitest/Jest)',
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

  return {
    maxFileLines: state.maxFileLines,
    testCoverage: state.testCoverage,
    enforceNaming: state.enforceNaming,
    fileNamingValue: state.fileNamingValue,
    coverageSummaryPath: state.coverageSummaryPath,
    coverageCommand: state.coverageCommand,
    packageOverrides: state.packageOverrides,
  };
}

/**
 * Prompt the user to select which integrations to set up.
 *
 * @param hookManager - Detected hook manager name (e.g. "Husky", "Lefthook") or undefined
 * @returns Object with selected integrations
 */
export async function promptIntegrations(
  hookManager: string | undefined,
): Promise<IntegrationChoice> {
  const hookLabel = hookManager ? `Pre-commit hook (${hookManager})` : 'Pre-commit hook (git hook)';

  const result = await clack.multiselect({
    message: 'Set up integrations?',
    options: [
      {
        value: 'preCommit' as const,
        label: hookLabel,
        hint: 'runs checks when you commit',
      },
      {
        value: 'claude' as const,
        label: 'Claude Code hook',
        hint: 'checks files when Claude edits them',
      },
      {
        value: 'claudeMd' as const,
        label: 'CLAUDE.md reference',
        hint: 'appends @.viberails/context.md so Claude loads rules automatically',
      },
    ],
    initialValues: ['preCommit', 'claude', 'claudeMd'],
    required: false,
  });
  assertNotCancelled(result);

  return {
    preCommitHook: result.includes('preCommit'),
    claudeCodeHook: result.includes('claude'),
    claudeMdRef: result.includes('claudeMd'),
  };
}
