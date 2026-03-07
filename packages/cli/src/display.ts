import type {
  DetectedConvention,
  PackageScanResult,
  ScanResult,
  StackItem,
} from '@viberails/types';
import { FRAMEWORK_NAMES, LIBRARY_NAMES, STYLING_NAMES } from '@viberails/types';
import chalk from 'chalk';
import {
  formatExtensions,
  formatRoleGroup,
  formatSummary,
  groupByRole,
} from './display-helpers.js';

/** Labels for convention keys. */
const CONVENTION_LABELS: Record<string, string> = {
  fileNaming: 'File naming',
  componentNaming: 'Component naming',
  hookNaming: 'Hook naming',
  importAlias: 'Import alias',
};

/**
 * Format a StackItem for display: "DisplayName Version".
 */
function formatItem(item: StackItem, nameMap?: Record<string, string>): string {
  const name = nameMap?.[item.name] ?? item.name;
  return item.version ? `${name} ${item.version}` : name;
}

/**
 * Format a confidence label for display.
 */
function confidenceLabel(convention: DetectedConvention): string {
  const pct = Math.round(convention.consistency);
  if (convention.confidence === 'high') {
    return `${pct}% — high confidence, will enforce`;
  }
  return `${pct}% — medium confidence, suggested only`;
}

/**
 * Format a package summary line for monorepo display.
 */
function formatPackageSummary(pkg: PackageScanResult): string {
  const parts: string[] = [];
  if (pkg.stack.framework) {
    parts.push(formatItem(pkg.stack.framework, FRAMEWORK_NAMES));
  }
  if (pkg.stack.styling) {
    parts.push(formatItem(pkg.stack.styling, STYLING_NAMES));
  }
  const files = `${pkg.statistics.totalFiles} files`;
  const detail = parts.length > 0 ? `${parts.join(', ')} (${files})` : `(${files})`;
  return `  ${pkg.relativePath} — ${detail}`;
}

/**
 * Display conventions section, shared between single-package and monorepo.
 */
function displayConventions(scanResult: ScanResult): void {
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
function displaySummarySection(scanResult: ScanResult): void {
  const pkgCount = scanResult.packages.length > 1 ? scanResult.packages.length : undefined;
  console.log(`\n${chalk.bold('Summary:')}`);
  console.log(`  ${formatSummary(scanResult.statistics, pkgCount)}`);
  const ext = formatExtensions(scanResult.statistics.filesByExtension);
  if (ext) {
    console.log(`  ${ext}`);
  }
}

/**
 * Display scan results for a monorepo with per-package summaries.
 */
function displayMonorepoResults(scanResult: ScanResult): void {
  const { stack, packages } = scanResult;

  console.log(`\n${chalk.bold(`Detected: (monorepo, ${packages.length} packages)`)}`);

  // Shared stack items at the top
  console.log(`  ${chalk.green('✓')} ${formatItem(stack.language)}`);
  if (stack.packageManager) {
    console.log(`  ${chalk.green('✓')} ${formatItem(stack.packageManager)}`);
  }
  if (stack.linter) {
    console.log(`  ${chalk.green('✓')} ${formatItem(stack.linter)}`);
  }
  if (stack.testRunner) {
    console.log(`  ${chalk.green('✓')} ${formatItem(stack.testRunner)}`);
  }

  // Per-package summaries
  console.log('');
  for (const pkg of packages) {
    console.log(formatPackageSummary(pkg));
  }

  // Structure grouped by role per package
  const packagesWithDirs = packages.filter((pkg) =>
    pkg.structure.directories.some((d) => d.role !== 'unknown'),
  );
  if (packagesWithDirs.length > 0) {
    console.log(`\n${chalk.bold('Structure:')}`);
    for (const pkg of packagesWithDirs) {
      const groups = groupByRole(pkg.structure.directories);
      if (groups.length === 0) continue;
      console.log(`  ${pkg.relativePath}:`);
      for (const group of groups) {
        console.log(`    ${chalk.green('✓')} ${formatRoleGroup(group)}`);
      }
    }
  }

  displayConventions(scanResult);
  displaySummarySection(scanResult);
  console.log('');
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
  if (stack.linter) {
    console.log(`  ${chalk.green('✓')} ${formatItem(stack.linter)}`);
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
