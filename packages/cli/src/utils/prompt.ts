import * as clack from '@clack/prompts';

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
 * Prompt the user to customize rule settings.
 *
 * @param defaults - Current detected/default values to pre-fill
 * @returns The user's chosen rule settings
 */
export async function promptRuleCustomization(defaults: {
  maxFileLines: number;
  requireTests: boolean;
  enforceNaming: boolean;
  enforcement: 'warn' | 'enforce';
  fileNamingValue?: string;
}): Promise<RuleOverrides> {
  const maxFileLinesResult = await clack.text({
    message: 'Maximum lines per source file?',
    placeholder: String(defaults.maxFileLines),
    initialValue: String(defaults.maxFileLines),
    validate: (v) => {
      const n = Number.parseInt(v, 10);
      if (Number.isNaN(n) || n < 1) return 'Enter a positive number';
    },
  });
  assertNotCancelled(maxFileLinesResult);

  const requireTestsResult = await clack.confirm({
    message: 'Require matching test files for source files?',
    initialValue: defaults.requireTests,
  });
  assertNotCancelled(requireTestsResult);

  const namingLabel = defaults.fileNamingValue
    ? `Enforce file naming? (detected: ${defaults.fileNamingValue})`
    : 'Enforce file naming?';
  const enforceNamingResult = await clack.confirm({
    message: namingLabel,
    initialValue: defaults.enforceNaming,
  });
  assertNotCancelled(enforceNamingResult);

  const enforcementResult = await clack.select({
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
    initialValue: defaults.enforcement,
  });
  assertNotCancelled(enforcementResult);

  return {
    maxFileLines: Number.parseInt(maxFileLinesResult, 10),
    requireTests: requireTestsResult,
    enforceNaming: enforceNamingResult,
    enforcement: enforcementResult,
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
    ],
    initialValues: ['preCommit', 'claude'],
    required: false,
  });
  assertNotCancelled(result);

  return {
    preCommitHook: result.includes('preCommit'),
    claudeCodeHook: result.includes('claude'),
  };
}
