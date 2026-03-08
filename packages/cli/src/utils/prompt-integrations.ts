import * as clack from '@clack/prompts';
import { assertNotCancelled } from './prompt.js';

export interface IntegrationChoice {
  preCommitHook: boolean;
  claudeCodeHook: boolean;
  claudeMdRef: boolean;
  githubAction: boolean;
  typecheckHook: boolean;
  lintHook: boolean;
}

export interface DetectedTools {
  isTypeScript?: boolean;
  linter?: string;
}

/**
 * Prompt the user to select which integrations to set up.
 *
 * @param hookManager - Detected hook manager name (e.g. "Husky", "Lefthook") or undefined
 * @param tools - Detected project tools (TypeScript, linter) to conditionally show options
 * @returns Object with selected integrations
 */
export async function promptIntegrations(
  hookManager: string | undefined,
  tools?: DetectedTools,
): Promise<IntegrationChoice> {
  const hookLabel = hookManager ? `Pre-commit hook (${hookManager})` : 'Pre-commit hook (git hook)';

  type OptionValue = 'preCommit' | 'claude' | 'claudeMd' | 'githubAction' | 'typecheck' | 'lint';

  const options: { value: OptionValue; label: string; hint: string }[] = [
    {
      value: 'preCommit',
      label: hookLabel,
      hint: 'runs viberails checks when you commit',
    },
  ];

  if (tools?.isTypeScript) {
    options.push({
      value: 'typecheck',
      label: 'Typecheck (tsc --noEmit)',
      hint: 'catches type errors before commit',
    });
  }

  if (tools?.linter) {
    const linterName = tools.linter === 'biome' ? 'Biome' : 'ESLint';
    options.push({
      value: 'lint',
      label: `Lint check (${linterName})`,
      hint: 'runs linter on staged files before commit',
    });
  }

  options.push(
    {
      value: 'claude',
      label: 'Claude Code hook',
      hint: 'checks files when Claude edits them',
    },
    {
      value: 'claudeMd',
      label: 'CLAUDE.md reference',
      hint: 'appends @.viberails/context.md so Claude loads rules automatically',
    },
    {
      value: 'githubAction',
      label: 'GitHub Actions workflow',
      hint: 'blocks PRs that fail viberails check',
    },
  );

  const initialValues = options.map((o) => o.value);

  const result = await clack.multiselect({
    message: 'Set up integrations?',
    options,
    initialValues,
    required: false,
  });
  assertNotCancelled(result);

  return {
    preCommitHook: result.includes('preCommit'),
    claudeCodeHook: result.includes('claude'),
    claudeMdRef: result.includes('claudeMd'),
    githubAction: result.includes('githubAction'),
    typecheckHook: result.includes('typecheck'),
    lintHook: result.includes('lint'),
  };
}
