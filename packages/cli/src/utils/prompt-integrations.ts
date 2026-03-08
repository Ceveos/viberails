import * as clack from '@clack/prompts';
import { assertNotCancelled } from './prompt.js';

export interface IntegrationChoice {
  preCommitHook: boolean;
  claudeCodeHook: boolean;
  claudeMdRef: boolean;
  githubAction: boolean;
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
      {
        value: 'githubAction' as const,
        label: 'GitHub Actions workflow',
        hint: 'blocks PRs that fail viberails check',
      },
    ],
    initialValues: ['preCommit', 'claude', 'claudeMd', 'githubAction'],
    required: false,
  });
  assertNotCancelled(result);

  return {
    preCommitHook: result.includes('preCommit'),
    claudeCodeHook: result.includes('claude'),
    claudeMdRef: result.includes('claudeMd'),
    githubAction: result.includes('githubAction'),
  };
}
