import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as clack from '@clack/prompts';
import type { ScanResult } from '@viberails/types';
import chalk from 'chalk';
import { assertNotCancelled } from './prompt.js';

export interface PrereqResult {
  label: string;
  installed: boolean;
  installCommand?: string;
  reason: string;
}

/**
 * Detect coverage prerequisites based on the scan result.
 * Checks whether the required coverage provider package is installed.
 */
export function checkCoveragePrereqs(projectRoot: string, scanResult: ScanResult): PrereqResult[] {
  const testRunner = scanResult.stack.testRunner;
  if (!testRunner) return [];

  const runner = testRunner.name;
  const pm = scanResult.stack.packageManager.name;

  if (runner === 'vitest') {
    const hasV8 = hasDependency(projectRoot, '@vitest/coverage-v8');
    const hasIstanbul = hasDependency(projectRoot, '@vitest/coverage-istanbul');
    const installed = hasV8 || hasIstanbul;
    const addCmd = pm === 'yarn' ? 'yarn add -D' : pm === 'npm' ? 'npm install -D' : `${pm} add -D`;
    return [
      {
        label: '@vitest/coverage-v8',
        installed,
        installCommand: installed ? undefined : `${addCmd} @vitest/coverage-v8`,
        reason: 'Required for coverage percentage checks with vitest',
      },
    ];
  }

  // Jest has built-in coverage support — no extra dependency needed
  return [];
}

/**
 * Display missing prereqs in non-interactive (--yes) mode.
 */
export function displayMissingPrereqs(prereqs: PrereqResult[]): void {
  const missing = prereqs.filter((p) => !p.installed);
  for (const m of missing) {
    console.log(`  ${chalk.yellow('!')} ${m.label} not installed \u2014 ${m.reason}`);
    if (m.installCommand) {
      console.log(`    Install: ${chalk.cyan(m.installCommand)}`);
    }
  }
}

export interface PrereqPromptResult {
  /** Whether the user chose to disable coverage percentage checks. */
  disableCoverage: boolean;
}

/**
 * Prompt the user to handle missing prereqs in interactive mode.
 * Offers three choices: install now, disable coverage, or skip (keep enabled but warn later).
 */
export async function promptMissingPrereqs(
  projectRoot: string,
  prereqs: PrereqResult[],
): Promise<PrereqPromptResult> {
  const missing = prereqs.filter((p) => !p.installed);
  if (missing.length === 0) return { disableCoverage: false };

  const prereqLines = prereqs
    .map(
      (p) =>
        `${p.installed ? '\u2713' : '\u2717'} ${p.label}${p.installed ? '' : ` \u2014 ${p.reason}`}`,
    )
    .join('\n');
  clack.note(prereqLines, 'Coverage prerequisites');

  let disableCoverage = false;

  for (const m of missing) {
    if (!m.installCommand) continue;

    const choice = await clack.select({
      message: `${m.label} is not installed. It is required for coverage percentage checks.`,
      options: [
        {
          value: 'install' as const,
          label: `Yes, install now`,
          hint: m.installCommand,
        },
        {
          value: 'disable' as const,
          label: 'No, disable coverage percentage checks',
          hint: 'missing-test checks still active',
        },
        {
          value: 'skip' as const,
          label: 'Skip for now',
          hint: `install later: ${m.installCommand}`,
        },
      ],
    });
    assertNotCancelled(choice);

    if (choice === 'install') {
      const is = clack.spinner();
      is.start(`Installing ${m.label}...`);
      const result = spawnSync(m.installCommand, {
        cwd: projectRoot,
        shell: true,
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      if (result.status === 0) {
        is.stop(`Installed ${m.label}`);
      } else {
        is.stop(`Failed to install ${m.label}`);
        clack.log.warn(
          `Install manually: ${m.installCommand}\n` +
            'Coverage percentage checks will not work until the dependency is installed.',
        );
      }
    } else if (choice === 'disable') {
      disableCoverage = true;
      clack.log.info('Coverage percentage checks disabled. Missing-test checks remain active.');
    } else {
      clack.log.info(
        `Coverage percentage checks will fail until ${m.label} is installed.\n` +
          `Install later: ${m.installCommand}`,
      );
    }
  }

  return { disableCoverage };
}

function hasDependency(projectRoot: string, name: string): boolean {
  try {
    const pkgPath = path.join(projectRoot, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return !!(pkg.devDependencies?.[name] || pkg.dependencies?.[name]);
  } catch {
    return false;
  }
}
