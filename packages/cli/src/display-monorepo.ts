import type { PackageScanResult, ScanResult } from '@viberails/types';
import { FRAMEWORK_NAMES, STYLING_NAMES } from '@viberails/types';
import chalk from 'chalk';
import { formatConventionsText } from './display-text.js';
import { displayConventions, displaySummarySection, formatItem } from './display.js';
import {
  formatExtensions,
  formatRoleGroup,
  formatSummary,
  groupByRole,
} from './display-helpers.js';

/**
 * Format a package summary line for monorepo display.
 */
export function formatPackageSummary(pkg: PackageScanResult): string {
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
 * Display scan results for a monorepo with per-package summaries.
 */
export function displayMonorepoResults(scanResult: ScanResult): void {
  const { stack, packages } = scanResult;

  console.log(`\n${chalk.bold(`Detected: (monorepo, ${packages.length} packages)`)}`);

  // Shared stack items at the top
  console.log(`  ${chalk.green('✓')} ${formatItem(stack.language)}`);
  if (stack.packageManager) {
    console.log(`  ${chalk.green('✓')} ${formatItem(stack.packageManager)}`);
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
 * Format a plain-text package summary line (no chalk).
 */
function formatPackageSummaryPlain(pkg: PackageScanResult): string {
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
 * Build monorepo scan results as a multi-line string for clack.note().
 * Returns plain text without chalk colors.
 */
export function formatMonorepoResultsText(scanResult: ScanResult): string {
  const lines: string[] = [];
  const { stack, packages } = scanResult;

  lines.push(`Detected: (monorepo, ${packages.length} packages)`);

  // Shared stack items as compact line
  const sharedParts: string[] = [formatItem(stack.language)];
  if (stack.packageManager) sharedParts.push(formatItem(stack.packageManager));
  if (stack.linter && stack.formatter && stack.linter.name === stack.formatter.name) {
    sharedParts.push(`${formatItem(stack.linter)} (lint + format)`);
  } else {
    if (stack.linter) sharedParts.push(formatItem(stack.linter));
    if (stack.formatter) sharedParts.push(formatItem(stack.formatter));
  }
  if (stack.testRunner) sharedParts.push(formatItem(stack.testRunner));
  lines.push(`  \u2713 ${sharedParts.join(' \u00b7 ')}`);

  // Per-package summaries
  lines.push('');
  for (const pkg of packages) {
    lines.push(formatPackageSummaryPlain(pkg));
  }

  // Structure grouped by role per package
  const packagesWithDirs = packages.filter((pkg) =>
    pkg.structure.directories.some((d) => d.role !== 'unknown'),
  );
  if (packagesWithDirs.length > 0) {
    lines.push('');
    lines.push('Structure:');
    for (const pkg of packagesWithDirs) {
      const groups = groupByRole(pkg.structure.directories);
      if (groups.length === 0) continue;
      lines.push(`  ${pkg.relativePath}:`);
      for (const group of groups) {
        lines.push(`    \u2713 ${formatRoleGroup(group)}`);
      }
    }
  }

  // Conventions
  lines.push(...formatConventionsText(scanResult));

  // Summary stats
  const pkgCount = packages.length > 1 ? packages.length : undefined;
  lines.push('');
  lines.push(formatSummary(scanResult.statistics, pkgCount));
  const ext = formatExtensions(scanResult.statistics.filesByExtension);
  if (ext) {
    lines.push(ext);
  }

  return lines.join('\n');
}
