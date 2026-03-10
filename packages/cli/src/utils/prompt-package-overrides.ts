import * as clack from '@clack/prompts';
import type { PackageConfig } from '@viberails/types';
import { assertNotCancelled } from './prompt.js';
import { SENTINEL_DONE, SENTINEL_INHERIT, SENTINEL_NONE } from './prompt-constants.js';
import { FILE_NAMING_OPTIONS } from './prompt-submenus.js';

/** @internal Exported for testing. */
export function normalizePackageOverrides(packages: PackageConfig[]): PackageConfig[] {
  for (const pkg of packages) {
    if (pkg.rules && Object.keys(pkg.rules).length === 0) {
      delete pkg.rules;
    }
    if (pkg.coverage && Object.keys(pkg.coverage).length === 0) {
      delete pkg.coverage;
    }
    if (pkg.conventions && Object.keys(pkg.conventions).length === 0) {
      delete pkg.conventions;
    }
  }
  return packages;
}

interface PackageOverrideDefaults {
  fileNamingValue?: string;
  maxFileLines: number;
  testCoverage: number;
  coverageSummaryPath: string;
  coverageCommand?: string;
}

/** @internal Exported for testing. */
export function packageOverrideHint(pkg: PackageConfig, defaults: PackageOverrideDefaults): string {
  const tags: string[] = [];

  // Naming override
  if (pkg.conventions?.fileNaming && pkg.conventions.fileNaming !== defaults.fileNamingValue) {
    tags.push(pkg.conventions.fileNaming);
  }

  // Max file lines override
  if (
    pkg.rules?.maxFileLines !== undefined &&
    pkg.rules.maxFileLines !== defaults.maxFileLines &&
    pkg.rules.maxFileLines > 0
  ) {
    tags.push(`${pkg.rules.maxFileLines} lines`);
  }

  // Coverage
  const coverage = pkg.rules?.testCoverage ?? defaults.testCoverage;
  const isExempt = coverage === 0;
  const nameSegments = pkg.name.replace(/^@[^/]+\//, '').split(/[-/]/);
  const isTypesOnly = isExempt && nameSegments.some((s) => s === 'types');
  if (isExempt) {
    tags.push(isTypesOnly ? 'exempt (types-only)' : 'exempt');
  } else if (
    pkg.rules?.testCoverage !== undefined &&
    pkg.rules.testCoverage !== defaults.testCoverage
  ) {
    tags.push(`${coverage}%`);
  }

  const hasSummaryOverride =
    pkg.coverage?.summaryPath !== undefined &&
    pkg.coverage.summaryPath !== defaults.coverageSummaryPath;
  const defaultCommand = defaults.coverageCommand ?? '';
  const hasCommandOverride =
    pkg.coverage?.command !== undefined && pkg.coverage.command !== defaultCommand;

  if (hasSummaryOverride) tags.push('summary override');
  if (hasCommandOverride) tags.push('command override');

  return tags.length > 0 ? tags.join(', ') : '(no overrides)';
}

/**
 * Prompt the user to edit per-package overrides in a monorepo.
 * Covers naming, file limits, and coverage settings.
 *
 * @param packages - All package configs (including root)
 * @param defaults - The shared default settings
 * @returns Updated package configs with user overrides applied
 */
export async function promptPackageOverrides(
  packages: PackageConfig[],
  defaults: PackageOverrideDefaults,
): Promise<PackageConfig[]> {
  const editablePackages = packages.filter((pkg) => pkg.path !== '.');
  if (editablePackages.length === 0) return packages;

  while (true) {
    const selectedPath = await clack.select({
      message: 'Select package to edit overrides',
      options: [
        ...editablePackages.map((pkg) => ({
          value: pkg.path,
          label: `${pkg.path} (${pkg.name})`,
          hint: packageOverrideHint(pkg, defaults),
        })),
        { value: SENTINEL_DONE, label: 'Done' },
      ],
    });
    assertNotCancelled(selectedPath);
    if (selectedPath === SENTINEL_DONE) break;

    const target = editablePackages.find((pkg) => pkg.path === selectedPath);
    if (!target) continue;

    await promptSinglePackageOverrides(target, defaults);
    normalizePackageOverrides(editablePackages);
  }

  return normalizePackageOverrides(packages);
}

async function promptSinglePackageOverrides(
  target: PackageConfig,
  defaults: PackageOverrideDefaults,
): Promise<void> {
  while (true) {
    const effectiveNaming = target.conventions?.fileNaming ?? defaults.fileNamingValue;
    const effectiveMaxLines = target.rules?.maxFileLines ?? defaults.maxFileLines;
    const effectiveCoverage = target.rules?.testCoverage ?? defaults.testCoverage;
    const effectiveSummary = target.coverage?.summaryPath ?? defaults.coverageSummaryPath;
    const effectiveCommand =
      target.coverage?.command ?? defaults.coverageCommand ?? '(auto-detect)';

    const hasNamingOverride =
      target.conventions?.fileNaming !== undefined &&
      target.conventions.fileNaming !== defaults.fileNamingValue;
    const hasMaxLinesOverride =
      target.rules?.maxFileLines !== undefined &&
      target.rules.maxFileLines !== defaults.maxFileLines;

    const namingHint = hasNamingOverride
      ? String(effectiveNaming)
      : `(inherits: ${effectiveNaming ?? 'not set'})`;
    const maxLinesHint = hasMaxLinesOverride
      ? String(effectiveMaxLines)
      : `(inherits: ${effectiveMaxLines})`;

    const choice = await clack.select({
      message: `Edit overrides for ${target.path}`,
      options: [
        { value: 'fileNaming', label: 'File naming', hint: namingHint },
        { value: 'maxFileLines', label: 'Max file lines', hint: maxLinesHint },
        { value: 'testCoverage', label: 'Test coverage', hint: String(effectiveCoverage) },
        { value: 'summaryPath', label: 'Coverage summary path', hint: effectiveSummary },
        { value: 'command', label: 'Coverage command', hint: effectiveCommand },
        { value: 'reset', label: 'Reset all overrides for this package' },
        { value: 'back', label: 'Back to package list' },
      ],
    });
    assertNotCancelled(choice);

    if (choice === 'back') break;

    if (choice === 'fileNaming') {
      const selected = await clack.select({
        message: `File naming for ${target.path}`,
        options: [
          ...FILE_NAMING_OPTIONS,
          { value: SENTINEL_NONE, label: '(none \u2014 exempt from checks)' },
          {
            value: SENTINEL_INHERIT,
            label: `Inherit default${defaults.fileNamingValue ? ` (${defaults.fileNamingValue})` : ''}`,
          },
        ],
        initialValue: target.conventions?.fileNaming ?? SENTINEL_INHERIT,
      });
      assertNotCancelled(selected);
      if (selected === SENTINEL_INHERIT) {
        if (target.conventions) delete target.conventions.fileNaming;
      } else if (selected === SENTINEL_NONE) {
        target.conventions = { ...(target.conventions ?? {}), fileNaming: '' };
      } else {
        target.conventions = { ...(target.conventions ?? {}), fileNaming: selected };
      }
    }

    if (choice === 'maxFileLines') {
      const result = await clack.text({
        message: `Max file lines for ${target.path} (blank to inherit default)?`,
        initialValue:
          target.rules?.maxFileLines !== undefined ? String(target.rules.maxFileLines) : '',
        placeholder: String(defaults.maxFileLines),
      });
      assertNotCancelled(result);
      const value = result.trim();
      if (value.length === 0 || Number.parseInt(value, 10) === defaults.maxFileLines) {
        if (target.rules) delete target.rules.maxFileLines;
      } else {
        target.rules = { ...(target.rules ?? {}), maxFileLines: Number.parseInt(value, 10) };
      }
    }

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
        if (target.rules) delete target.rules.testCoverage;
      } else {
        target.rules = { ...(target.rules ?? {}), testCoverage: nextCoverage };
      }
    }

    if (choice === 'summaryPath') {
      const result = await clack.text({
        message: 'Path to coverage summary file (blank to inherit default)?',
        initialValue: target.coverage?.summaryPath !== undefined ? target.coverage.summaryPath : '',
        placeholder: defaults.coverageSummaryPath,
      });
      assertNotCancelled(result);
      const value = result.trim();
      if (value.length === 0 || value === defaults.coverageSummaryPath) {
        if (target.coverage) delete target.coverage.summaryPath;
      } else {
        target.coverage = { ...(target.coverage ?? {}), summaryPath: value };
      }
    }

    if (choice === 'command') {
      const result = await clack.text({
        message: 'Coverage command (blank to auto-detect)?',
        initialValue: target.coverage?.command !== undefined ? target.coverage.command : '',
        placeholder: defaults.coverageCommand ?? '(auto-detect from package.json test runner)',
      });
      assertNotCancelled(result);
      const value = result.trim();
      const defaultCommand = defaults.coverageCommand ?? '';
      if (value.length === 0 || value === defaultCommand) {
        if (target.coverage) delete target.coverage.command;
      } else {
        target.coverage = { ...(target.coverage ?? {}), command: value };
      }
    }

    if (choice === 'reset') {
      if (target.rules) {
        delete target.rules.testCoverage;
        delete target.rules.maxFileLines;
      }
      delete target.coverage;
      delete target.conventions;
    }
  }
}
