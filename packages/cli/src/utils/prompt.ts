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
 * Check whether a clack prompt result was cancelled (Escape / Ctrl+C).
 * Use in sub-menus where cancel should return to the parent menu instead of exiting.
 */
export function isCancelled<T>(value: T | symbol): value is symbol {
  return clack.isCancel(value);
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
 * Prompt the user for how to handle an existing config file.
 *
 * @param configFile - The config filename
 * @returns 'edit', 'replace', or 'cancel'
 */
export async function promptExistingConfigAction(
  configFile: string,
): Promise<'edit' | 'replace' | 'cancel'> {
  const result = await clack.select({
    message: `${configFile} already exists. What do you want to do?`,
    options: [
      {
        value: 'edit' as const,
        label: 'Edit existing config',
        hint: 'open the current rules and save updates in place',
      },
      {
        value: 'replace' as const,
        label: 'Replace with a fresh scan',
        hint: 're-scan the project and overwrite the current config',
      },
      {
        value: 'cancel' as const,
        label: 'Cancel',
        hint: 'leave the current setup unchanged',
      },
    ],
  });
  assertNotCancelled(result);
  return result;
}

export type { IntegrationChoice } from './prompt-integrations.js';
export type { RuleOverrides } from './prompt-rules.js';
export { promptRuleMenu } from './prompt-rules.js';
