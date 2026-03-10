import * as clack from '@clack/prompts';
import { spawnAsync } from './spawn-async.js';

export interface DeferredInstall {
  /** Human-readable label for spinner messages (e.g. "@vitest/coverage-v8") */
  label: string;
  /** Shell command to execute (e.g. "pnpm add -D -w @vitest/coverage-v8") */
  command: string;
  /** Callback to run on install failure (e.g., disable coverage in config) */
  onFailure?: () => void;
}

/**
 * Execute all deferred installs sequentially.
 * Shows spinner progress for each. On failure, warns and calls onFailure if provided.
 *
 * @param projectRoot - Project root directory for command execution
 * @param installs - List of deferred installs to execute
 * @returns Count of successful installs
 */
export async function executeDeferredInstalls(
  projectRoot: string,
  installs: DeferredInstall[],
): Promise<number> {
  if (installs.length === 0) return 0;

  let successCount = 0;

  for (const install of installs) {
    const s = clack.spinner();
    s.start(`Installing ${install.label}...`);
    const result = await spawnAsync(install.command, projectRoot);

    if (result.status === 0) {
      s.stop(`Installed ${install.label}`);
      successCount++;
    } else {
      s.stop(`Failed to install ${install.label}`);
      clack.log.warn(`Install manually: ${install.command}`);
      install.onFailure?.();
    }
  }

  return successCount;
}
