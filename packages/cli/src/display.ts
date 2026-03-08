import type { DetectedConvention, ScanResult, StackItem, ViberailsConfig } from '@viberails/types';
import {
  CONVENTION_LABELS,
  FRAMEWORK_NAMES,
  LIBRARY_NAMES,
  ORM_NAMES,
  STYLING_NAMES,
} from '@viberails/types';
import chalk from 'chalk';
import {
  formatExtensions,
  formatRoleGroup,
  formatSummary,
  groupByRole,
} from './display-helpers.js';
import { displayMonorepoResults } from './display-monorepo.js';

/**
 * Format a StackItem for display: "DisplayName Version".
 */
export function formatItem(item: StackItem, nameMap?: Record<string, string>): string {
  const name = nameMap?.[item.name] ?? item.name;
  return item.version ? `${name} ${item.version}` : name;
}

/**
 * Format a confidence label for display.
 */
export function confidenceLabel(convention: DetectedConvention): string {
  const pct = Math.round(convention.consistency);
  if (convention.confidence === 'high') {
    return `${pct}% — high confidence, will enforce`;
  }
  return `${pct}% — medium confidence, suggested only`;
}

/**
 * Display conventions section, shared between single-package and monorepo.
 */
export function displayConventions(scanResult: ScanResult): void {
  const conventionEntries = Object.entries(scanResult.conventions);
  if (conventionEntries.length === 0) return;

  console.log(`\n${chalk.bold('Conventions:')}`);
  for (const [key, convention] of conventionEntries) {
    if (convention.confidence === 'low') continue;
    const label = CONVENTION_LABELS[key] ?? key;

    if (scanResult.packages.length > 1) {
      const pkgValues = scanResult.packages
        .filter((pkg) => pkg.conventions[key] && pkg.conventions[key].confidence !== 'low')
        .map((pkg) => ({ relativePath: pkg.relativePath, convention: pkg.conventions[key] }));

      const allSame = pkgValues.every((pv) => pv.convention.value === convention.value);

      if (allSame || pkgValues.length <= 1) {
        const ind = convention.confidence === 'high' ? chalk.green('✓') : chalk.yellow('~');
        const detail = chalk.dim(`(${confidenceLabel(convention)})`);
        console.log(`  ${ind} ${label}: ${convention.value} ${detail}`);
      } else {
        console.log(`  ${chalk.yellow('~')} ${label}: varies by package`);
        for (const pv of pkgValues) {
          const pct = Math.round(pv.convention.consistency);
          console.log(`    ${pv.relativePath}: ${pv.convention.value} (${pct}%)`);
        }
      }
    } else {
      const ind = convention.confidence === 'high' ? chalk.green('✓') : chalk.yellow('~');
      const detail = chalk.dim(`(${confidenceLabel(convention)})`);
      console.log(`  ${ind} ${label}: ${convention.value} ${detail}`);
    }
  }
}

/**
 * Display summary section with statistics.
 */
export function displaySummarySection(scanResult: ScanResult): void {
  const pkgCount = scanResult.packages.length > 1 ? scanResult.packages.length : undefined;
  console.log(`\n${chalk.bold('Summary:')}`);
  console.log(`  ${formatSummary(scanResult.statistics, pkgCount)}`);
  const ext = formatExtensions(scanResult.statistics.filesByExtension);
  if (ext) {
    console.log(`  ${ext}`);
  }
}

/**
 * Display scan results to the console with confidence indicators.
 *
 * @param scanResult - The scan result to display
 */
export function displayScanResults(scanResult: ScanResult): void {
  if (scanResult.packages.length > 1) {
    displayMonorepoResults(scanResult);
    return;
  }

  const { stack } = scanResult;

  console.log(`\n${chalk.bold('Detected:')}`);

  if (stack.framework) {
    console.log(`  ${chalk.green('✓')} ${formatItem(stack.framework, FRAMEWORK_NAMES)}`);
  }
  console.log(`  ${chalk.green('✓')} ${formatItem(stack.language)}`);
  if (stack.styling) {
    console.log(`  ${chalk.green('✓')} ${formatItem(stack.styling, STYLING_NAMES)}`);
  }
  if (stack.backend) {
    console.log(`  ${chalk.green('✓')} ${formatItem(stack.backend, FRAMEWORK_NAMES)}`);
  }
  if (stack.orm) {
    console.log(`  ${chalk.green('✓')} ${formatItem(stack.orm, ORM_NAMES)}`);
  }
  if (stack.linter && stack.formatter && stack.linter.name === stack.formatter.name) {
    console.log(`  ${chalk.green('✓')} ${formatItem(stack.linter)} (lint + format)`);
  } else {
    if (stack.linter) {
      console.log(`  ${chalk.green('✓')} ${formatItem(stack.linter)}`);
    }
    if (stack.formatter) {
      console.log(`  ${chalk.green('✓')} ${formatItem(stack.formatter)}`);
    }
  }
  if (stack.testRunner) {
    console.log(`  ${chalk.green('✓')} ${formatItem(stack.testRunner)}`);
  }
  if (stack.packageManager) {
    console.log(`  ${chalk.green('✓')} ${formatItem(stack.packageManager)}`);
  }
  if (stack.libraries.length > 0) {
    for (const lib of stack.libraries) {
      console.log(`  ${chalk.green('✓')} ${formatItem(lib, LIBRARY_NAMES)}`);
    }
  }

  // Structure grouped by role
  const groups = groupByRole(scanResult.structure.directories);
  if (groups.length > 0) {
    console.log(`\n${chalk.bold('Structure:')}`);
    for (const group of groups) {
      console.log(`  ${chalk.green('✓')} ${formatRoleGroup(group)}`);
    }
  }

  displayConventions(scanResult);
  displaySummarySection(scanResult);
  console.log('');
}

/**
 * Display a preview of the rules that will be enforced.
 * Used in the non-interactive (--yes) path.
 */
export function displayRulesPreview(config: ViberailsConfig): void {
  const root = config.packages.find((p) => p.path === '.') ?? config.packages[0];

  console.log(
    `${chalk.bold('Rules:')} ${chalk.dim('(warns on violation; use --enforce in CI to block)')}`,
  );
  console.log(`  ${chalk.dim('\u2022')} Max file size: ${config.rules.maxFileLines} lines`);

  if (config.rules.testCoverage > 0 && root?.structure?.testPattern) {
    console.log(
      `  ${chalk.dim('\u2022')} Test coverage target: ${config.rules.testCoverage}% (${root.structure.testPattern})`,
    );
  } else if (config.rules.testCoverage > 0) {
    console.log(`  ${chalk.dim('\u2022')} Test coverage target: ${config.rules.testCoverage}%`);
  } else {
    console.log(`  ${chalk.dim('\u2022')} Test coverage target: disabled`);
  }

  if (config.rules.enforceNaming && root?.conventions?.fileNaming) {
    console.log(`  ${chalk.dim('\u2022')} Enforce file naming: ${root.conventions.fileNaming}`);
  } else {
    console.log(`  ${chalk.dim('\u2022')} Enforce file naming: no`);
  }

  console.log(
    `  ${chalk.dim('\u2022')} Enforce boundaries: ${config.rules.enforceBoundaries ? 'yes' : 'no'}`,
  );

  console.log('');
}

/**
 * Display a colorful summary of rules right before the accept/customize prompt.
 * Designed to always be visible even when scan details have scrolled off.
 *
 * @param config - The generated config
 * @param exemptedPackages - Package paths exempted from coverage
 */
export function displayInitSummary(config: ViberailsConfig, exemptedPackages: string[]): void {
  const root = config.packages.find((p) => p.path === '.') ?? config.packages[0];
  const isMonorepo = config.packages.length > 1;
  const ok = chalk.green('✓');
  const off = chalk.dim('○');

  console.log('');
  console.log(`  ${chalk.bold('Rules to apply:')}`);

  // Max file size
  console.log(`  ${ok} Max file size: ${chalk.cyan(`${config.rules.maxFileLines} lines`)}`);

  // File naming
  if (config.rules.enforceNaming && root?.conventions?.fileNaming) {
    console.log(`  ${ok} File naming: ${chalk.cyan(root.conventions.fileNaming)}`);
  } else {
    console.log(`  ${off} File naming: ${chalk.dim('not enforced')}`);
  }

  // Missing tests
  if (config.rules.enforceMissingTests && root?.structure?.testPattern) {
    console.log(`  ${ok} Missing tests: ${chalk.cyan(`enforced (${root.structure.testPattern})`)}`);
  } else if (config.rules.enforceMissingTests) {
    console.log(`  ${ok} Missing tests: ${chalk.cyan('enforced')}`);
  } else {
    console.log(`  ${off} Missing tests: ${chalk.dim('not enforced')}`);
  }

  // Coverage
  if (config.rules.testCoverage > 0) {
    if (isMonorepo) {
      const withCoverage = config.packages.filter(
        (p) => (p.rules?.testCoverage ?? config.rules.testCoverage) > 0,
      );
      console.log(
        `  ${ok} Coverage: ${chalk.cyan(`${config.rules.testCoverage}%`)} default ${chalk.dim(`(${withCoverage.length}/${config.packages.length} packages)`)}`,
      );
    } else {
      console.log(`  ${ok} Coverage: ${chalk.cyan(`${config.rules.testCoverage}%`)}`);
    }
  } else {
    console.log(`  ${off} Coverage: ${chalk.dim('disabled')}`);
  }

  // Exempted packages
  if (exemptedPackages.length > 0) {
    console.log(
      `  ${chalk.dim('  exempted:')} ${chalk.dim(exemptedPackages.join(', '))} ${chalk.dim('(types-only)')}`,
    );
  }

  // Stats line
  if (isMonorepo) {
    console.log(
      `\n  ${chalk.dim(`${config.packages.length} packages scanned · warns on violation · use --enforce in CI`)}`,
    );
  } else {
    console.log(`\n  ${chalk.dim('warns on violation · use --enforce in CI to block')}`);
  }

  console.log('');
}
