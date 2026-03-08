import * as clack from '@clack/prompts';
import type { PackageConfig } from '@viberails/types';
import { assertNotCancelled } from './prompt.js';

function normalizePackageOverrides(packages: PackageConfig[]): PackageConfig[] {
  for (const pkg of packages) {
    if (pkg.rules && Object.keys(pkg.rules).length === 0) {
      delete pkg.rules;
    }
    if (pkg.coverage && Object.keys(pkg.coverage).length === 0) {
      delete pkg.coverage;
    }
  }
  return packages;
}

function packageCoverageHint(
  pkg: PackageConfig,
  defaults: { testCoverage: number; coverageSummaryPath: string; coverageCommand?: string },
): string {
  const coverage = pkg.rules?.testCoverage ?? defaults.testCoverage;
  const isExempt = coverage === 0;
  const hasSummaryOverride =
    pkg.coverage?.summaryPath !== undefined &&
    pkg.coverage.summaryPath !== defaults.coverageSummaryPath;
  const defaultCommand = defaults.coverageCommand ?? '';
  const hasCommandOverride =
    pkg.coverage?.command !== undefined && pkg.coverage.command !== defaultCommand;

  const tags: string[] = [];
  const nameSegments = pkg.name.replace(/^@[^/]+\//, '').split(/[-/]/);
  const isTypesOnly = isExempt && nameSegments.some((s) => s === 'types');
  tags.push(isExempt ? (isTypesOnly ? 'exempt (types-only)' : 'exempt') : `${coverage}%`);
  if (hasSummaryOverride) tags.push('summary override');
  if (hasCommandOverride) tags.push('command override');
  return tags.join(', ');
}

/**
 * Prompt the user to edit per-package coverage overrides in a monorepo.
 * Presents a package selector followed by per-package edit menus.
 *
 * @param packages - All package configs (including root)
 * @param defaults - The shared default coverage settings
 * @returns Updated package configs with user overrides applied
 */
export async function promptPackageCoverageOverrides(
  packages: PackageConfig[],
  defaults: { testCoverage: number; coverageSummaryPath: string; coverageCommand?: string },
): Promise<PackageConfig[]> {
  const editablePackages = packages.filter((pkg) => pkg.path !== '.');
  if (editablePackages.length === 0) return packages;

  while (true) {
    const selectedPath = await clack.select({
      message: 'Select package to edit coverage overrides',
      options: [
        ...editablePackages.map((pkg) => ({
          value: pkg.path,
          label: `${pkg.path} (${pkg.name})`,
          hint: packageCoverageHint(pkg, defaults),
        })),
        { value: '__done__', label: 'Done' },
      ],
    });
    assertNotCancelled(selectedPath);
    if (selectedPath === '__done__') break;

    const target = editablePackages.find((pkg) => pkg.path === selectedPath);
    if (!target) continue;

    while (true) {
      const effectiveCoverage: number = target.rules?.testCoverage ?? defaults.testCoverage;
      const effectiveSummary: string = target.coverage?.summaryPath ?? defaults.coverageSummaryPath;
      const effectiveCommand: string =
        target.coverage?.command ?? defaults.coverageCommand ?? '(auto-detect)';

      const choice: string | symbol = await clack.select({
        message: `Edit coverage overrides for ${target.path}`,
        options: [
          { value: 'testCoverage', label: 'testCoverage', hint: String(effectiveCoverage) },
          { value: 'summaryPath', label: 'coverage.summaryPath', hint: effectiveSummary },
          { value: 'command', label: 'coverage.command', hint: effectiveCommand },
          { value: 'reset', label: 'Reset this package to inherit defaults' },
          { value: 'back', label: 'Back to package list' },
        ],
      });
      assertNotCancelled(choice);

      if (choice === 'back') break;

      if (choice === 'testCoverage') {
        const result = await clack.text({
          message: 'Package testCoverage (0 to exempt package)?',
          initialValue: String(effectiveCoverage),
          validate: (v) => {
            if (typeof v !== 'string') return 'Enter a number between 0 and 100';
            const n = Number.parseInt(v, 10);
            if (Number.isNaN(n) || n < 0 || n > 100) return 'Enter a number between 0 and 100';
          },
        });
        assertNotCancelled(result);
        const nextCoverage = Number.parseInt(result, 10);
        if (nextCoverage === defaults.testCoverage) {
          if (target.rules) {
            delete target.rules.testCoverage;
          }
        } else {
          target.rules = { ...(target.rules ?? {}), testCoverage: nextCoverage };
        }
      }

      if (choice === 'summaryPath') {
        const result = await clack.text({
          message: 'Package coverage.summaryPath (blank to inherit default)?',
          initialValue:
            target.coverage?.summaryPath !== undefined ? target.coverage.summaryPath : '',
          placeholder: defaults.coverageSummaryPath,
        });
        assertNotCancelled(result);
        const value = result.trim();
        if (value.length === 0 || value === defaults.coverageSummaryPath) {
          if (target.coverage) {
            delete target.coverage.summaryPath;
          }
        } else {
          target.coverage = { ...(target.coverage ?? {}), summaryPath: value };
        }
      }

      if (choice === 'command') {
        const result = await clack.text({
          message: 'Package coverage.command (blank to inherit default/auto)?',
          initialValue: target.coverage?.command !== undefined ? target.coverage.command : '',
          placeholder: defaults.coverageCommand ?? '(auto-detect from package.json test runner)',
        });
        assertNotCancelled(result);
        const value = result.trim();
        const defaultCommand = defaults.coverageCommand ?? '';
        if (value.length === 0 || value === defaultCommand) {
          if (target.coverage) {
            delete target.coverage.command;
          }
        } else {
          target.coverage = { ...(target.coverage ?? {}), command: value };
        }
      }

      if (choice === 'reset') {
        if (target.rules) {
          delete target.rules.testCoverage;
        }
        delete target.coverage;
      }

      normalizePackageOverrides(editablePackages);
    }
  }

  return normalizePackageOverrides(packages);
}
