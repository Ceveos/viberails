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

function buildVitestInstallCommand(pm: string, isWorkspace: boolean): string {
  if (pm === 'yarn') return 'yarn add -D vitest';
  if (pm === 'npm') return 'npm install -D vitest';
  return isWorkspace ? 'pnpm add -D -w vitest' : 'pnpm add -D vitest';
}

/** Build the readiness note lines. Returns empty array if everything is detected. */
export function buildReadinessLines(
  hasTestRunner: boolean,
  testRunnerName: string | undefined,
  hookManager: string | undefined,
  linterName: string | undefined,
  typecheckResolved: { label?: string; reason?: string },
): string[] {
  const ok = chalk.green('\u2713');
  const warn = chalk.yellow('!');
  const dim = chalk.dim('-');

  const lines: string[] = [];
  let hasMissing = false;

  // Test runner
  if (hasTestRunner) {
    lines.push(`${ok} Test runner     ${testRunnerName ?? 'detected'}`);
  } else {
    lines.push(`${warn} Test runner     not detected`);
    hasMissing = true;
  }

  // Hook manager
  if (hookManager) {
    lines.push(`${ok} Hook manager    ${hookManager}`);
  } else {
    lines.push(`${warn} Hook manager    not detected`);
    hasMissing = true;
  }

  // Linter (informational only)
  if (linterName) {
    const name = linterName === 'biome' ? 'Biome' : linterName === 'eslint' ? 'ESLint' : linterName;
    lines.push(`${ok} Linter          ${name}`);
  } else {
    lines.push(`${dim} Linter          none`);
  }

  // Typecheck (informational only)
  if (typecheckResolved.label) {
    lines.push(`${ok} Typecheck       ${typecheckResolved.label}`);
  } else {
    lines.push(`${warn} Typecheck       needs root tsconfig.json, typecheck script, or turbo task`);
    hasMissing = true;
  }

  return hasMissing ? lines : [];
}

/**
 * Check prerequisites before entering the main menu.
 * Shows a readiness summary, then prompts to install missing tools.
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
  const typecheckResolved = resolveTypecheckCommand(projectRoot, packageManager);

  // Show readiness note if anything is missing
  const lines = buildReadinessLines(
    hasTestRunner,
    scanResult.stack.testRunner?.name,
    currentHookManager,
    linterName,
    typecheckResolved,
  );
  if (lines.length > 0) {
    clack.note(lines.join('\n'), 'Project readiness');
  }

  // Prompt for installable items
  if (!hasTestRunner) {
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
      } else {
        s.stop('Failed to install vitest');
        clack.log.warn(`Install manually: ${cmd}`);
        skipCoverage = true;
      }
    } else if (choice === 'skip') {
      skipCoverage = true;
    } else {
      clack.outro('Aborted.');
      process.exit(0);
    }
  }

  if (!currentHookManager) {
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
      } else {
        s.stop('Failed to install lefthook');
        clack.log.warn(`Install manually: ${cmd}`);
        skipHooks = true;
      }
    } else if (choice === 'skip') {
      skipHooks = true;
    } else {
      clack.outro('Aborted.');
      process.exit(0);
    }
  }

  return {
    hasTestRunner,
    hookManager: currentHookManager,
    skipCoverage,
    skipHooks,
    typecheckLabel: typecheckResolved.label,
  };
}
