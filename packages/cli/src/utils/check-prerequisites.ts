import * as fs from 'node:fs';
import * as path from 'node:path';
import * as clack from '@clack/prompts';
import type { ScanResult } from '@viberails/types';
import chalk from 'chalk';
import { assertNotCancelled } from './prompt.js';
import { spawnAsync } from './spawn-async.js';

export interface PrereqResult {
  label: string;
  installed: boolean;
  installCommand?: string;
  reason: string;
  /** Package paths that use the runner requiring this dependency (monorepo). */
  affectedPackages?: string[];
}

/**
 * Detect coverage prerequisites based on the scan result.
 * Checks whether the required coverage provider package is installed.
 * In monorepos, scans all packages for their test runners.
 */
export function checkCoveragePrereqs(projectRoot: string, scanResult: ScanResult): PrereqResult[] {
  const pm = scanResult.stack.packageManager.name;

  // Collect vitest-using packages from per-package scan results
  const vitestPackages = scanResult.packages
    .filter((pkg) => pkg.stack.testRunner?.name === 'vitest')
    .map((pkg) => pkg.relativePath);

  // Fall back to global runner for single-package projects or empty packages array
  const hasVitest = vitestPackages.length > 0 || scanResult.stack.testRunner?.name === 'vitest';

  if (!hasVitest) return [];

  // Check root package.json first (workspace hoisting makes this available everywhere)
  let installed =
    hasDependency(projectRoot, '@vitest/coverage-v8') ||
    hasDependency(projectRoot, '@vitest/coverage-istanbul');

  // If not at root, check whether every vitest-using package has it locally
  if (!installed && vitestPackages.length > 0) {
    installed = vitestPackages.every((rel) => {
      const pkgDir = path.join(projectRoot, rel);
      return (
        hasDependency(pkgDir, '@vitest/coverage-v8') ||
        hasDependency(pkgDir, '@vitest/coverage-istanbul')
      );
    });
  }

  const isWorkspace = scanResult.packages.length > 1;
  const addCmd =
    pm === 'yarn'
      ? 'yarn add -D'
      : pm === 'pnpm' && isWorkspace
        ? 'pnpm add -D -w'
        : pm === 'npm'
          ? 'npm install -D'
          : `${pm} add -D`;
  const affectedPackages = vitestPackages.length > 1 ? vitestPackages : undefined;
  const reason = affectedPackages
    ? `Required for coverage in: ${affectedPackages.join(', ')}`
    : 'Required for coverage percentage checks with vitest';

  return [
    {
      label: '@vitest/coverage-v8',
      installed,
      installCommand: installed ? undefined : `${addCmd} @vitest/coverage-v8`,
      reason,
      affectedPackages,
    },
  ];
}

/**
 * Display missing prereqs in non-interactive (--yes) mode.
 */
export function displayMissingPrereqs(prereqs: PrereqResult[]): void {
  const missing = prereqs.filter((p) => !p.installed);
  for (const m of missing) {
    const suffix = m.affectedPackages
      ? ` \u2014 needed for coverage in: ${m.affectedPackages.join(', ')}`
      : ` \u2014 ${m.reason}`;
    console.log(`  ${chalk.yellow('!')} ${m.label} not installed${suffix}`);
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
    .map((p) => {
      if (p.installed) return `\u2713 ${p.label}`;
      const detail = p.affectedPackages ? `needed by: ${p.affectedPackages.join(', ')}` : p.reason;
      return `\u2717 ${p.label} \u2014 ${detail}`;
    })
    .join('\n');
  clack.note(prereqLines, 'Coverage support');

  let disableCoverage = false;

  for (const m of missing) {
    if (!m.installCommand) continue;

    const pkgCount = m.affectedPackages?.length;
    const message = pkgCount
      ? `${m.label} is not installed. Required for coverage in ${pkgCount} packages using vitest.`
      : `${m.label} is not installed. It is required for coverage percentage checks.`;
    const choice = await clack.select({
      message,
      options: [
        {
          value: 'install' as const,
          label: 'Install now',
          hint: m.installCommand,
        },
        {
          value: 'disable' as const,
          label: 'Disable coverage checks',
          hint: 'missing-test checks still stay active',
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
      const result = await spawnAsync(m.installCommand, projectRoot);
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
