import type { DetectedConvention, ScanResult, ViberailsConfig } from '@viberails/types';
import {
  CONVENTION_LABELS,
  FRAMEWORK_NAMES,
  LIBRARY_NAMES,
  ORM_NAMES,
  STYLING_NAMES,
} from '@viberails/types';
import { formatItem } from './display.js';
import {
  formatExtensions,
  formatRoleGroup,
  formatSummary,
  groupByRole,
} from './display-helpers.js';
import { formatMonorepoResultsText } from './display-monorepo.js';

// Conventions are plain strings — no extraction needed.

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
  const root = config.packages.find((p) => p.path === '.') ?? config.packages[0];
  const lines: string[] = [];
  lines.push(`Max file size: ${config.rules.maxFileLines} lines`);

  if (config.rules.testCoverage > 0 && root?.structure?.testPattern) {
    lines.push(
      `Test coverage target: ${config.rules.testCoverage}% (${root.structure.testPattern}; also gates missing-test checks)`,
    );
  } else if (config.rules.testCoverage > 0) {
    lines.push(
      `Test coverage target: ${config.rules.testCoverage}% (also gates missing-test checks)`,
    );
  } else {
    lines.push('Test coverage target: disabled (coverage + missing-test checks off)');
  }

  if (config.rules.enforceNaming && root?.conventions?.fileNaming) {
    lines.push(`Enforce file naming: ${root.conventions.fileNaming}`);
  } else {
    lines.push('Enforce file naming: no');
  }

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
export function formatScanResultsText(scanResult: ScanResult): string {
  if (scanResult.packages.length > 1) {
    return formatMonorepoResultsText(scanResult);
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

  return lines.join('\n');
}
