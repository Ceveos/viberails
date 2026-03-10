import * as fs from 'node:fs';
import * as path from 'node:path';
import * as clack from '@clack/prompts';
import type { ScanResult } from '@viberails/types';
import chalk from 'chalk';
import { detectHookManager } from '../commands/init-hooks.js';
import { resolveTypecheckCommand } from '../commands/resolve-typecheck.js';
import { assertNotCancelled } from './prompt.js';
import { buildLefthookInstallCommand } from './prompt-integrations.js';
import { spawnAsync } from './spawn-async.js';

export interface PrereqResolution {
  hasTestRunner: boolean;
  hookManager: string | undefined;
  skipCoverage: boolean;
  skipHooks: boolean;
  typecheckLabel: string | undefined;
}

type ItemStatus = 'ok' | 'missing' | 'skipped';

interface ReadinessState {
  testRunner: { status: ItemStatus; label?: string };
  hookManager: { status: ItemStatus; label?: string };
  linter: { status: 'ok' | 'none'; label?: string };
  typecheck: { status: ItemStatus; label?: string; reason?: string };
}

function buildVitestInstallCommand(pm: string, isWorkspace: boolean): string {
  if (pm === 'yarn') return 'yarn add -D vitest';
  if (pm === 'npm') return 'npm install -D vitest';
  return isWorkspace ? 'pnpm add -D -w vitest' : 'pnpm add -D vitest';
}

function statusIcon(status: ItemStatus | 'none'): string {
  if (status === 'ok') return chalk.green('\u2713');
  if (status === 'missing') return chalk.yellow('!');
  if (status === 'skipped') return chalk.dim('\u2717');
  return chalk.dim('-'); // none
}

/** Build the readiness note content from current state. */
export function buildReadinessNote(state: ReadinessState): string {
  const lines: string[] = [];

  const tr = state.testRunner;
  lines.push(
    `${statusIcon(tr.status)} Test runner     ${tr.label ?? (tr.status === 'skipped' ? 'skipped' : 'not detected')}`,
  );

  const hm = state.hookManager;
  lines.push(
    `${statusIcon(hm.status)} Hook manager    ${hm.label ?? (hm.status === 'skipped' ? 'skipped' : 'not detected')}`,
  );

  const li = state.linter;
  lines.push(`${statusIcon(li.status)} Linter          ${li.label ?? 'none'}`);

  const tc = state.typecheck;
  if (tc.status === 'ok') {
    lines.push(`${statusIcon('ok')} Typecheck       ${tc.label}`);
  } else if (tc.status === 'skipped') {
    lines.push(`${statusIcon('skipped')} Typecheck       skipped`);
  } else {
    lines.push(
      `${statusIcon('missing')} Typecheck       needs root tsconfig.json, typecheck script, or turbo task`,
    );
  }

  return lines.join('\n');
}

/** Returns true if any items need attention. */
function hasMissing(state: ReadinessState): boolean {
  return (
    state.testRunner.status === 'missing' ||
    state.hookManager.status === 'missing' ||
    state.typecheck.status === 'missing'
  );
}

/**
 * Check prerequisites before entering the main menu.
 * Shows an iterative readiness summary, prompting for each missing item.
 */
export async function promptPrereqs(
  projectRoot: string,
  scanResult: ScanResult,
  hookManager: string | undefined,
  packageManager: string,
  isWorkspace: boolean,
): Promise<PrereqResolution> {
  let hasTestRunner = !!scanResult.stack.testRunner;
  let currentHookManager = hookManager;
  let skipCoverage = false;
  let skipHooks = false;

  const linterName = scanResult.stack.linter?.name;
  const linterLabel =
    linterName === 'biome' ? 'Biome' : linterName === 'eslint' ? 'ESLint' : linterName;
  const typecheckResolved = resolveTypecheckCommand(projectRoot, packageManager);

  const state: ReadinessState = {
    testRunner: hasTestRunner
      ? { status: 'ok', label: scanResult.stack.testRunner?.name }
      : { status: 'missing' },
    hookManager: currentHookManager
      ? { status: 'ok', label: currentHookManager }
      : { status: 'missing' },
    linter: linterName ? { status: 'ok', label: linterLabel } : { status: 'none' },
    typecheck: typecheckResolved.label
      ? { status: 'ok', label: typecheckResolved.label }
      : { status: 'missing', reason: typecheckResolved.reason },
  };

  // If everything is ready, skip the readiness screen entirely
  if (!hasMissing(state)) {
    return {
      hasTestRunner,
      hookManager: currentHookManager,
      skipCoverage,
      skipHooks,
      typecheckLabel: typecheckResolved.label,
    };
  }

  // --- Test runner ---
  if (state.testRunner.status === 'missing') {
    clack.note(buildReadinessNote(state), 'Project readiness');
    const cmd = buildVitestInstallCommand(packageManager, isWorkspace);
    const choice = await clack.select({
      message: 'No test runner detected. Coverage checks require one.',
      options: [
        { value: 'install' as const, label: 'Install vitest', hint: cmd },
        { value: 'skip' as const, label: 'Skip \u2014 disable coverage checks' },
        { value: 'exit' as const, label: 'Exit' },
      ],
    });
    assertNotCancelled(choice);

    if (choice === 'install') {
      const s = clack.spinner();
      s.start('Installing vitest...');
      const result = await spawnAsync(cmd, projectRoot);
      if (result.status === 0) {
        s.stop('Installed vitest');
        hasTestRunner = true;
        state.testRunner = { status: 'ok', label: 'vitest' };
      } else {
        s.stop('Failed to install vitest');
        clack.log.warn(`Install manually: ${cmd}`);
        skipCoverage = true;
        state.testRunner = { status: 'skipped' };
      }
    } else if (choice === 'skip') {
      skipCoverage = true;
      state.testRunner = { status: 'skipped' };
    } else {
      clack.outro('Aborted.');
      process.exit(0);
    }
  }

  // --- Hook manager ---
  if (state.hookManager.status === 'missing') {
    clack.note(buildReadinessNote(state), 'Project readiness');
    const cmd = buildLefthookInstallCommand(packageManager, isWorkspace);
    const choice = await clack.select({
      message: 'No git hook manager detected. Pre-commit integration requires one.',
      options: [
        { value: 'install' as const, label: 'Install lefthook', hint: cmd },
        { value: 'skip' as const, label: 'Skip \u2014 no pre-commit integration' },
        { value: 'exit' as const, label: 'Exit' },
      ],
    });
    assertNotCancelled(choice);

    if (choice === 'install') {
      const s = clack.spinner();
      s.start('Installing lefthook...');
      const result = await spawnAsync(cmd, projectRoot);
      if (result.status === 0) {
        s.stop('Installed lefthook');
        const ymlPath = path.join(projectRoot, 'lefthook.yml');
        if (!fs.existsSync(ymlPath)) {
          fs.writeFileSync(ymlPath, '# Managed by viberails\npre-commit:\n  commands: {}\n');
        }
        currentHookManager = detectHookManager(projectRoot);
        state.hookManager = { status: 'ok', label: currentHookManager ?? 'lefthook' };
      } else {
        s.stop('Failed to install lefthook');
        clack.log.warn(`Install manually: ${cmd}`);
        skipHooks = true;
        state.hookManager = { status: 'skipped' };
      }
    } else if (choice === 'skip') {
      skipHooks = true;
      state.hookManager = { status: 'skipped' };
    } else {
      clack.outro('Aborted.');
      process.exit(0);
    }
  }

  // --- Typecheck (informational — not installable) ---
  if (state.typecheck.status === 'missing') {
    clack.note(buildReadinessNote(state), 'Project readiness');
    const choice = await clack.select({
      message:
        'No typecheck command found. Without this, pre-commit and CI typecheck hooks will be unavailable.',
      options: [
        {
          value: 'continue' as const,
          label: 'Continue without typecheck',
          hint: 'add a root tsconfig.json or typecheck script later, then re-run viberails',
        },
        { value: 'exit' as const, label: 'Exit \u2014 fix this first' },
      ],
    });
    assertNotCancelled(choice);

    if (choice === 'exit') {
      clack.outro(
        'Add a root tsconfig.json, a typecheck script, or a turbo typecheck task, then re-run viberails.',
      );
      process.exit(0);
    }
    state.typecheck = { status: 'skipped' };
  }

  return {
    hasTestRunner,
    hookManager: currentHookManager,
    skipCoverage,
    skipHooks,
    typecheckLabel: typecheckResolved.label,
  };
}
