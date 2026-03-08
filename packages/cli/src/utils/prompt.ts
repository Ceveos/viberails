import * as clack from '@clack/prompts';
import type { PackageConfigOverrides } from '@viberails/types';

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
  requireTests: boolean;
  enforceNaming: boolean;
  enforcement: 'warn' | 'enforce';
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
  requireTests: boolean;
  enforceNaming: boolean;
  enforcement: 'warn' | 'enforce';
  fileNamingValue?: string;
  packageOverrides?: PackageConfigOverrides[];
}): Promise<RuleOverrides> {
  const state = { ...defaults };

  while (true) {
    const namingHint = state.enforceNaming
      ? `yes${state.fileNamingValue ? ` (${state.fileNamingValue})` : ''}`
      : 'no';
    const enforcementHint =
      state.enforcement === 'warn'
        ? 'warn — violations shown but commits allowed'
        : 'enforce — commits blocked on violation';

    const options: { value: string; label: string; hint?: string }[] = [
      { value: 'maxFileLines', label: 'Max file lines', hint: String(state.maxFileLines) },
      {
        value: 'requireTests',
        label: 'Require test files',
        hint: state.requireTests ? 'yes' : 'no',
      },
      { value: 'enforceNaming', label: 'Enforce file naming', hint: namingHint },
      { value: 'enforcement', label: 'Enforcement mode', hint: enforcementHint },
    ];

    if (state.packageOverrides && state.packageOverrides.length > 0) {
      const count = state.packageOverrides.length;
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

    if (choice === 'packageOverrides' && state.packageOverrides) {
      const lines = state.packageOverrides.map((pkg) => {
        const diffs: string[] = [];
        if (pkg.conventions) {
          for (const [key, val] of Object.entries(pkg.conventions)) {
            const v = typeof val === 'string' ? val : val?.value;
            if (v) diffs.push(`${key}: ${v}`);
          }
        }
        if (pkg.stack) {
          for (const [key, val] of Object.entries(pkg.stack)) {
            if (val) diffs.push(`${key}: ${val}`);
          }
        }
        return `${pkg.path}\n  ${diffs.join(', ') || 'minor differences'}`;
      });
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
          const n = Number.parseInt(v, 10);
          if (Number.isNaN(n) || n < 1) return 'Enter a positive number';
        },
      });
      assertNotCancelled(result);
      state.maxFileLines = Number.parseInt(result, 10);
    }

    if (choice === 'requireTests') {
      const result = await clack.confirm({
        message: 'Require matching test files for source files?',
        initialValue: state.requireTests,
      });
      assertNotCancelled(result);
      state.requireTests = result;
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

    if (choice === 'enforcement') {
      const result = await clack.select({
        message: 'Enforcement mode',
        options: [
          {
            value: 'warn' as const,
            label: 'warn',
            hint: "show violations but don't block commits (recommended)",
          },
          {
            value: 'enforce' as const,
            label: 'enforce',
            hint: 'block commits with violations',
          },
        ],
        initialValue: state.enforcement,
      });
      assertNotCancelled(result);
      state.enforcement = result;
    }
  }

  return {
    maxFileLines: state.maxFileLines,
    requireTests: state.requireTests,
    enforceNaming: state.enforceNaming,
    enforcement: state.enforcement,
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
