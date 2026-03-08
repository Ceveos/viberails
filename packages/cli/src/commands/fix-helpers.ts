import { execSync } from 'node:child_process';
import chalk from 'chalk';
import type { RenameRecord } from './fix-naming.js';
import type { TestStubRecord } from './fix-tests.js';

/**
 * Display the planned renames and test stubs.
 */
export function printPlan(renames: RenameRecord[], stubs: TestStubRecord[]): void {
  if (renames.length > 0) {
    console.log(chalk.bold('\nFile renames:'));
    for (const r of renames) {
      console.log(`  ${chalk.red(r.oldPath)} → ${chalk.green(r.newPath)}`);
    }
  }

  if (stubs.length > 0) {
    console.log(chalk.bold('\nTest stubs to create:'));
    for (const s of stubs) {
      console.log(`  ${chalk.green('+')} ${s.path}`);
    }
  }
}

/**
 * Check if the git working tree has uncommitted changes.
 */
export function checkGitDirty(projectRoot: string): boolean {
  try {
    const output = execSync('git status --porcelain', {
      cwd: projectRoot,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return output.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Extract the string value from a convention.
 * Conventions are always plain strings.
 */
export function getConventionValue(convention: unknown): string | undefined {
  if (typeof convention === 'string') return convention;
  return undefined;
}
