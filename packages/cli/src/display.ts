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
import { displayMonorepoResults, formatMonorepoResultsText } from './display-monorepo.js';

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
  if (stack.linter) {
    console.log(`  ${chalk.green('✓')} ${formatItem(stack.linter)}`);
  }
  if (stack.formatter) {
    console.log(`  ${chalk.green('✓')} ${formatItem(stack.formatter)}`);
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
 * Extract the convention value string from a ConventionValue.
 */
function getConventionStr(
  cv: string | { value: string; _confidence: string; _consistency: number },
): string {
  return typeof cv === 'string' ? cv : cv.value;
}

/**
 * Display a preview of the rules that will be enforced.
 */
export function displayRulesPreview(config: ViberailsConfig): void {
  console.log(`${chalk.bold('Rules:')}`);
  console.log(`  ${chalk.dim('\u2022')} Max file size: ${config.rules.maxFileLines} lines`);

  if (config.rules.requireTests && config.structure.testPattern) {
    console.log(
      `  ${chalk.dim('\u2022')} Require test files: yes (${config.structure.testPattern})`,
    );
  } else if (config.rules.requireTests) {
    console.log(`  ${chalk.dim('\u2022')} Require test files: yes`);
  } else {
    console.log(`  ${chalk.dim('\u2022')} Require test files: no`);
  }

  if (config.rules.enforceNaming && config.conventions.fileNaming) {
    console.log(
      `  ${chalk.dim('\u2022')} Enforce file naming: ${getConventionStr(config.conventions.fileNaming)}`,
    );
  } else {
    console.log(`  ${chalk.dim('\u2022')} Enforce file naming: no`);
  }

  console.log(
    `  ${chalk.dim('\u2022')} Enforce boundaries: ${config.rules.enforceBoundaries ? 'yes' : 'no'}`,
  );

  console.log('');

  if (config.enforcement === 'enforce') {
    console.log(`${chalk.bold('Enforcement mode:')} enforce (violations will block commits)`);
  } else {
    console.log(
      `${chalk.bold('Enforcement mode:')} warn (violations shown but won't block commits)`,
    );
  }
  console.log('');
}

/**
 * Format a plain-text confidence label (no chalk).
 */
function plainConfidenceLabel(convention: DetectedConvention): string {
  const pct = Math.round(convention.consistency);
  if (convention.confidence === 'high') {
    return `${pct}%`;
  }
  return `${pct}%, suggested only`;
}

/**
 * Build conventions section as plain text lines.
 */
export function formatConventionsText(scanResult: ScanResult): string[] {
  const lines: string[] = [];
  const conventionEntries = Object.entries(scanResult.conventions);
  if (conventionEntries.length === 0) return lines;

  lines.push('');
  lines.push('Conventions:');
  for (const [key, convention] of conventionEntries) {
    if (convention.confidence === 'low') continue;
    const label = CONVENTION_LABELS[key] ?? key;

    if (scanResult.packages.length > 1) {
      const pkgValues = scanResult.packages
        .filter((pkg) => pkg.conventions[key] && pkg.conventions[key].confidence !== 'low')
        .map((pkg) => ({ relativePath: pkg.relativePath, convention: pkg.conventions[key] }));

      const allSame = pkgValues.every((pv) => pv.convention.value === convention.value);

      if (allSame || pkgValues.length <= 1) {
        const ind = convention.confidence === 'high' ? '\u2713' : '~';
        lines.push(`  ${ind} ${label}: ${convention.value} (${plainConfidenceLabel(convention)})`);
      } else {
        lines.push(`  ~ ${label}: varies by package`);
        for (const pv of pkgValues) {
          const pct = Math.round(pv.convention.consistency);
          lines.push(`    ${pv.relativePath}: ${pv.convention.value} (${pct}%)`);
        }
      }
    } else {
      const ind = convention.confidence === 'high' ? '\u2713' : '~';
      lines.push(`  ${ind} ${label}: ${convention.value} (${plainConfidenceLabel(convention)})`);
    }
  }
  return lines;
}

/**
 * Build rules preview as plain text lines.
 */
export function formatRulesText(config: ViberailsConfig): string[] {
  const lines: string[] = [];
  lines.push('');
  lines.push('Rules:');
  lines.push(`  \u2022 Max file size: ${config.rules.maxFileLines} lines`);

  if (config.rules.requireTests && config.structure.testPattern) {
    lines.push(`  \u2022 Require test files: yes (${config.structure.testPattern})`);
  } else if (config.rules.requireTests) {
    lines.push('  \u2022 Require test files: yes');
  } else {
    lines.push('  \u2022 Require test files: no');
  }

  if (config.rules.enforceNaming && config.conventions.fileNaming) {
    lines.push(`  \u2022 Enforce file naming: ${getConventionStr(config.conventions.fileNaming)}`);
  } else {
    lines.push('  \u2022 Enforce file naming: no');
  }

  lines.push(`  \u2022 Enforcement mode: ${config.enforcement}`);

  return lines;
}

/**
 * Build scan results as a multi-line string for clack.note().
 * Returns plain text without chalk colors.
 *
 * @param scanResult - The scan result to format
 * @param config - The generated config (for rules preview)
 * @returns Formatted multi-line string
 */
export function formatScanResultsText(scanResult: ScanResult, config: ViberailsConfig): string {
  if (scanResult.packages.length > 1) {
    return formatMonorepoResultsText(scanResult, config);
  }

  const lines: string[] = [];
  const { stack } = scanResult;

  lines.push('Detected:');
  if (stack.framework) {
    lines.push(`  \u2713 ${formatItem(stack.framework, FRAMEWORK_NAMES)}`);
  }
  lines.push(`  \u2713 ${formatItem(stack.language)}`);
  if (stack.styling) {
    lines.push(`  \u2713 ${formatItem(stack.styling, STYLING_NAMES)}`);
  }
  if (stack.backend) {
    lines.push(`  \u2713 ${formatItem(stack.backend, FRAMEWORK_NAMES)}`);
  }
  if (stack.orm) {
    lines.push(`  \u2713 ${formatItem(stack.orm, ORM_NAMES)}`);
  }

  // Compact secondary tools line
  const secondaryParts: string[] = [];
  if (stack.packageManager) secondaryParts.push(formatItem(stack.packageManager));
  if (stack.linter) secondaryParts.push(formatItem(stack.linter));
  if (stack.formatter) secondaryParts.push(formatItem(stack.formatter));
  if (stack.testRunner) secondaryParts.push(formatItem(stack.testRunner));
  if (secondaryParts.length > 0) {
    lines.push(`  \u2713 ${secondaryParts.join(' \u00b7 ')}`);
  }

  if (stack.libraries.length > 0) {
    for (const lib of stack.libraries) {
      lines.push(`  \u2713 ${formatItem(lib, LIBRARY_NAMES)}`);
    }
  }

  // Structure
  const groups = groupByRole(scanResult.structure.directories);
  if (groups.length > 0) {
    lines.push('');
    lines.push('Structure:');
    for (const group of groups) {
      lines.push(`  \u2713 ${formatRoleGroup(group)}`);
    }
  }

  // Conventions
  lines.push(...formatConventionsText(scanResult));

  // Summary stats
  const pkgCount = scanResult.packages.length > 1 ? scanResult.packages.length : undefined;
  lines.push('');
  lines.push(formatSummary(scanResult.statistics, pkgCount));
  const ext = formatExtensions(scanResult.statistics.filesByExtension);
  if (ext) {
    lines.push(ext);
  }

  // Rules
  lines.push(...formatRulesText(config));

  return lines.join('\n');
}
