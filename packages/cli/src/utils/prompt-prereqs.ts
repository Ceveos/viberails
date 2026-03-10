import * as fs from 'node:fs';
import * as path from 'node:path';
import * as clack from '@clack/prompts';
import type { ScanResult } from '@viberails/types';
import { detectHookManager } from '../commands/init-hooks.js';
import { assertNotCancelled } from './prompt.js';
import { buildLefthookInstallCommand } from './prompt-integrations.js';
import { spawnAsync } from './spawn-async.js';

export interface PrereqResolution {
  hasTestRunner: boolean;
  hookManager: string | undefined;
  skipCoverage: boolean;
  skipHooks: boolean;
}

function buildVitestInstallCommand(pm: string, isWorkspace: boolean): string {
  if (pm === 'yarn') return 'yarn add -D vitest';
  if (pm === 'npm') return 'npm install -D vitest';
  return isWorkspace ? 'pnpm add -D -w vitest' : 'pnpm add -D vitest';
}

/**
 * Check prerequisites (test runner, hook manager) before entering the main menu.
 * Prompts the user to install missing tools or skip related features.
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

  return { hasTestRunner, hookManager: currentHookManager, skipCoverage, skipHooks };
}
