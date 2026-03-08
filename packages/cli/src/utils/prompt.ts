import * as clack from '@clack/prompts';

/**
 * Assert that a clack prompt result was not cancelled (Ctrl+C).
 * If cancelled, prints a message and exits the process.
 */
export function assertNotCancelled<T>(value: T | symbol): asserts value is T {
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

/**
 * Prompt the user to choose between accepting defaults or customizing rules.
 *
 * @returns 'accept' or 'customize'
 */
export async function promptInitDecision(): Promise<'accept' | 'customize'> {
  const result = await clack.select({
    message: 'Accept these rules?',
    options: [
      {
        value: 'accept' as const,
        label: 'Yes, looks good',
        hint: 'warns on violation; use --enforce in CI to block',
      },
      { value: 'customize' as const, label: 'Let me customize rules' },
    ],
  });
  assertNotCancelled(result);
  return result;
}

// Re-export from split modules so existing imports continue to work
export { promptRuleMenu } from './prompt-rules.js';
export type { RuleOverrides } from './prompt-rules.js';
export { promptIntegrations } from './prompt-integrations.js';
export type { IntegrationChoice } from './prompt-integrations.js';
