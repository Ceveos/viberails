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

  return diffs;
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
  packageOverrides?: PackageConfig[];
}): Promise<RuleOverrides> {
  const state = { ...defaults };
  const root =
    state.packageOverrides && state.packageOverrides.length > 0
      ? getRootPackage(state.packageOverrides)
      : undefined;
  const packageDiffs =
    root && state.packageOverrides
      ? state.packageOverrides
          .filter((pkg) => pkg.path !== root.path)
          .map((pkg) => ({ pkg, diffs: getPackageDiffs(pkg, root) }))
          .filter((entry) => entry.diffs.length > 0)
      : [];

  while (true) {
    const namingHint = state.enforceNaming
      ? `yes${state.fileNamingValue ? ` (${state.fileNamingValue})` : ''}`
      : 'no';

    const options: { value: string; label: string; hint?: string }[] = [
      { value: 'maxFileLines', label: 'Max file lines', hint: String(state.maxFileLines) },
      {
        value: 'testCoverage',
        label: 'Test coverage target',
        hint: `${state.testCoverage}%`,
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

    if (packageDiffs.length > 0) {
      const count = packageDiffs.length;
      options.push({
        value: 'packageOverrides',
        label: 'Per-package overrides',
        hint: `${count} package${count > 1 ? 's' : ''} differ (view)`,
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
      const lines = packageDiffs.map((entry) => `${entry.pkg.path}\n  ${entry.diffs.join(', ')}`);
      clack.note(
        `${lines.join('\n\n')}\n\nEdit the "packages" section in viberails.config.json to adjust.`,
        'Per-package overrides',
      );
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
        message: 'Test coverage target (0 to disable)?',
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
