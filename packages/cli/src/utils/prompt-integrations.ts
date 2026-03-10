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
  /** Resolved typecheck command label, or undefined if none can be inferred. */
  typecheckLabel?: string;
  linter?: string;
  packageManager?: string;
  isWorkspace?: boolean;
}

/** Build the shell command to install Lefthook for the given package manager. */
export function buildLefthookInstallCommand(pm: string, isWorkspace?: boolean): string {
  if (pm === 'yarn') return 'yarn add -D lefthook';
  if (pm === 'pnpm') return `pnpm add -D${isWorkspace ? ' -w' : ''} lefthook`;
  if (pm === 'npm') return 'npm install -D lefthook';
  return `${pm} add -D lefthook`;
}

export interface IntegrationResult {
  choice: IntegrationChoice;
}

/** Prompt integrations as a multiselect after config is finalized. */
export async function promptIntegrationsDeferred(
  hookManager: string | undefined,
  tools?: DetectedTools,
): Promise<IntegrationResult> {
  type OptionValue = 'preCommit' | 'claude' | 'claudeMd' | 'githubAction' | 'typecheck' | 'lint';

  const hasHookManager = !!hookManager;
  const options: { value: OptionValue; label: string; hint: string }[] = [];

  const hookLabel = hasHookManager ? `Pre-commit hook (${hookManager})` : 'Pre-commit hook';
  const hookHint = hasHookManager
    ? 'runs viberails checks when you commit'
    : 'local hook only — use lefthook or husky to commit hooks to repo';

  options.push({ value: 'preCommit', label: hookLabel, hint: hookHint });

  if (tools?.typecheckLabel) {
    options.push({
      value: 'typecheck',
      label: `Typecheck (${tools.typecheckLabel})`,
      hint: 'pre-commit hook + CI check',
    });
  } else if (tools?.isTypeScript) {
    options.push({
      value: 'typecheck',
      label: 'Typecheck',
      hint: 'needs root tsconfig.json, typecheck script, or turbo task',
    });
  }

  if (tools?.linter) {
    const linterName = tools.linter === 'biome' ? 'Biome' : 'ESLint';
    options.push({
      value: 'lint',
      label: `Lint check (${linterName})`,
      hint: 'pre-commit hook + CI check',
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

  // Default-check everything except: pre-commit when no hook manager, typecheck when unresolvable
  const hasTypecheck = !!tools?.typecheckLabel;
  const initialValues = options
    .filter((o) => {
      if (o.value === 'preCommit' && !hasHookManager) return false;
      if (o.value === 'typecheck' && !hasTypecheck) return false;
      return true;
    })
    .map((o) => o.value);

  const result = await clack.multiselect({
    message: 'Integrations',
    options,
    initialValues,
    required: false,
  });
  assertNotCancelled(result);

  return {
    choice: {
      preCommitHook: result.includes('preCommit'),
      claudeCodeHook: result.includes('claude'),
      claudeMdRef: result.includes('claudeMd'),
      githubAction: result.includes('githubAction'),
      typecheckHook: result.includes('typecheck'),
      lintHook: result.includes('lint'),
    },
  };
}
