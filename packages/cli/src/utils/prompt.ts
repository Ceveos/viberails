import * as readline from 'node:readline';
import chalk from 'chalk';

/**
 * Prompt the user for a yes/no confirmation.
 *
 * @param message - The question to display (without the Y/n suffix)
 * @returns true if the user confirms, false otherwise
 */
export async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise<boolean>((resolve) => {
    rl.question(`${message} (Y/n) `, (answer) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      resolve(trimmed === '' || trimmed === 'y' || trimmed === 'yes');
    });
  });
}

export interface IntegrationChoice {
  preCommitHook: boolean;
  claudeCodeHook: boolean;
}

/**
 * Prompt the user to select which integrations to set up.
 *
 * @param hookManager - Detected hook manager name (e.g. "Husky", "Lefthook") or undefined
 * @returns Object with selected integrations
 */
export async function selectIntegrations(
  hookManager: string | undefined,
): Promise<IntegrationChoice> {
  const result: IntegrationChoice = { preCommitHook: true, claudeCodeHook: true };

  const hookLabel = hookManager
    ? `Pre-commit hook (detected: ${hookManager})`
    : 'Pre-commit hook (git hook)';

  console.log('Set up integrations:');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const askYn = (label: string, defaultYes: boolean): Promise<boolean> =>
    new Promise<boolean>((resolve) => {
      const hint = defaultYes ? 'Y/n' : 'y/N';
      rl.question(`  ${label}? (${hint}) `, (answer) => {
        const trimmed = answer.trim().toLowerCase();
        if (trimmed === '') resolve(defaultYes);
        else resolve(trimmed === 'y' || trimmed === 'yes');
      });
    });

  console.log(`    ${chalk.dim('Runs viberails check automatically when you commit')}`);
  result.preCommitHook = await askYn(hookLabel, true);
  console.log(`    ${chalk.dim('Checks files against your rules when Claude edits them')}`);
  result.claudeCodeHook = await askYn('Claude Code hook', true);
  rl.close();

  return result;
}
