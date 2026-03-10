import * as clack from '@clack/prompts';
import type { DeferredInstall } from './deferred-install.js';
import { assertNotCancelled } from './prompt.js';
import { spawnAsync } from './spawn-async.js';

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
  packageManager?: string;
  isWorkspace?: boolean;
}

/**
 * Prompt the user to install Lefthook when no hook manager is detected.
 * Returns the updated hook manager name, or undefined if the user declined.
 */
async function promptHookManagerInstall(
  projectRoot: string,
  packageManager: string,
  isWorkspace?: boolean,
): Promise<string | undefined> {
  const choice = await clack.select({
    message: 'No shared git hook manager detected. Install Lefthook?',
    options: [
      {
        value: 'install' as const,
        label: 'Yes, install Lefthook',
        hint: 'recommended — hooks are committed to the repo and shared with your team',
      },
      {
        value: 'skip' as const,
        label: 'No, skip',
        hint: 'pre-commit hooks will be local-only (.git/hooks) and not shared',
      },
    ],
  });
  assertNotCancelled(choice);

  if (choice !== 'install') return undefined;

  const pm = packageManager || 'npm';
  const installCmd = buildLefthookInstallCommand(pm, isWorkspace);

  const s = clack.spinner();
  s.start('Installing Lefthook...');
  const result = await spawnAsync(installCmd, projectRoot);

  if (result.status === 0) {
    // Create a minimal lefthook.yml so setupPreCommitHook detects it
    const fs = await import('node:fs');
    const path = await import('node:path');
    const lefthookPath = path.join(projectRoot, 'lefthook.yml');
    if (!fs.existsSync(lefthookPath)) {
      fs.writeFileSync(lefthookPath, '# Managed by viberails — https://viberails.sh\n');
    }
    s.stop('Installed Lefthook');
    return 'Lefthook';
  }

  s.stop('Failed to install Lefthook');
  clack.log.warn(`Install manually: ${installCmd}`);
  return undefined;
}

/**
 * Prompt the user to select which integrations to set up.
 *
 * @param projectRoot - Project root directory (needed for Lefthook install)
 * @param hookManager - Detected hook manager name (e.g. "Husky", "Lefthook") or undefined
 * @param tools - Detected project tools (TypeScript, linter) to conditionally show options
 * @returns Object with selected integrations
 */
export async function promptIntegrations(
  projectRoot: string,
  hookManager: string | undefined,
  tools?: DetectedTools,
): Promise<IntegrationChoice> {
  let resolvedHookManager = hookManager;

  // If no hook manager, offer to install Lefthook
  if (!resolvedHookManager) {
    resolvedHookManager = await promptHookManagerInstall(
      projectRoot,
      tools?.packageManager ?? 'npm',
      tools?.isWorkspace,
    );
  }

  const isBareHook = !resolvedHookManager;
  const hookLabel = resolvedHookManager
    ? `Pre-commit hook (${resolvedHookManager})`
    : 'Pre-commit hook (git hook — local only)';
  const hookHint = isBareHook
    ? 'local only — will NOT be committed or shared with collaborators'
    : 'runs viberails checks when you commit';

  type OptionValue = 'preCommit' | 'claude' | 'claudeMd' | 'githubAction' | 'typecheck' | 'lint';

  const options: { value: OptionValue; label: string; hint: string }[] = [
    {
      value: 'preCommit',
      label: hookLabel,
      hint: hookHint,
    },
  ];

  if (tools?.isTypeScript) {
    options.push({
      value: 'typecheck',
      label: 'Typecheck (tsc --noEmit)',
      hint: 'pre-commit hook + CI check',
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

  // Default-disable pre-commit when using bare git hooks
  const initialValues = isBareHook
    ? options.filter((o) => o.value !== 'preCommit').map((o) => o.value)
    : options.map((o) => o.value);

  const result = await clack.multiselect({
    message: 'Optional integrations',
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

/** Build the shell command to install Lefthook for the given package manager. */
export function buildLefthookInstallCommand(pm: string, isWorkspace?: boolean): string {
  if (pm === 'yarn') return 'yarn add -D lefthook';
  if (pm === 'pnpm') return `pnpm add -D${isWorkspace ? ' -w' : ''} lefthook`;
  if (pm === 'npm') return 'npm install -D lefthook';
  return `${pm} add -D lefthook`;
}

export interface IntegrationResult {
  choice: IntegrationChoice;
  /** If user opted to install Lefthook, includes the deferred install */
  lefthookInstall?: DeferredInstall;
}

/** Prompt integrations with Lefthook install as a deferred multiselect option. */
export async function promptIntegrationsDeferred(
  hookManager: string | undefined,
  tools?: DetectedTools,
  packageManager?: string,
  isWorkspace?: boolean,
): Promise<IntegrationResult> {
  type OptionValue =
    | 'installLefthook'
    | 'preCommit'
    | 'claude'
    | 'claudeMd'
    | 'githubAction'
    | 'typecheck'
    | 'lint';

  const options: { value: OptionValue; label: string; hint: string }[] = [];

  // Offer Lefthook install as a deferred option when no hook manager exists
  const needsLefthook = !hookManager;
  if (needsLefthook) {
    const pm = packageManager ?? 'npm';
    options.push({
      value: 'installLefthook',
      label: 'Install Lefthook',
      hint: `after final confirmation — ${buildLefthookInstallCommand(pm, isWorkspace)}`,
    });
  }

  const hookLabel = hookManager ? `Pre-commit hook (${hookManager})` : 'Pre-commit hook (Lefthook)';
  const hookHint = needsLefthook
    ? 'requires Lefthook install above'
    : 'runs viberails checks when you commit';

  options.push({ value: 'preCommit', label: hookLabel, hint: hookHint });

  if (tools?.isTypeScript) {
    options.push({
      value: 'typecheck',
      label: 'Typecheck (tsc --noEmit)',
      hint: 'pre-commit hook + CI check',
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

  const initialValues = options.map((o) => o.value);

  const result = await clack.multiselect({
    message: 'Integrations',
    options,
    initialValues,
    required: false,
  });
  assertNotCancelled(result);

  let lefthookInstall: DeferredInstall | undefined;
  if (needsLefthook && result.includes('installLefthook')) {
    const pm = packageManager ?? 'npm';
    lefthookInstall = {
      label: 'Lefthook',
      command: buildLefthookInstallCommand(pm, isWorkspace),
    };
  }

  return {
    choice: {
      preCommitHook: result.includes('preCommit'),
      claudeCodeHook: result.includes('claude'),
      claudeMdRef: result.includes('claudeMd'),
      githubAction: result.includes('githubAction'),
      typecheckHook: result.includes('typecheck'),
      lintHook: result.includes('lint'),
    },
    lefthookInstall,
  };
}
