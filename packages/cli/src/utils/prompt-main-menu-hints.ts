import type { ScanResult, ViberailsConfig } from '@viberails/types';
import chalk from 'chalk';
import { getRootPackage } from './get-root-package.js';
import type { InitMenuState } from './prompt-main-menu-types.js';

/** @internal Exported for testing. */
export function fileLimitsHint(config: ViberailsConfig): string {
  const max = config.rules.maxFileLines;
  const test = config.rules.maxTestFileLines;
  return test > 0 ? `${max} lines, tests ${test}` : `${max} lines`;
}

/**
 * Find the effective file naming for the project.
 * Checks the root package first, then looks for consensus across all packages.
 * @internal Exported for testing.
 */
export function getEffectiveFileNaming(
  config: ViberailsConfig,
): { naming: string; source: 'root' | 'consensus' } | undefined {
  const rootPkg = getRootPackage(config.packages);
  if (rootPkg.conventions?.fileNaming) {
    return { naming: rootPkg.conventions.fileNaming, source: 'root' };
  }
  // In monorepos, check if all packages with file naming agree
  if (config.packages.length > 1) {
    const namingValues = config.packages
      .map((p) => p.conventions?.fileNaming)
      .filter((n): n is string => !!n);
    if (namingValues.length > 0 && new Set(namingValues).size === 1) {
      return { naming: namingValues[0], source: 'consensus' };
    }
  }
  return undefined;
}

/** @internal Exported for testing. */
export function fileNamingHint(config: ViberailsConfig, scanResult: ScanResult): string {
  if (!config.rules.enforceNaming) return 'not enforced';
  const effective = getEffectiveFileNaming(config);
  if (effective) {
    const detected = scanResult.packages.some(
      (p) =>
        p.conventions.fileNaming?.value === effective.naming &&
        p.conventions.fileNaming.confidence !== 'low',
    );
    return detected ? `${effective.naming} (detected)` : effective.naming;
  }
  return 'not set \u2014 select to configure';
}

/** @internal Exported for testing. */
export function fileNamingStatus(config: ViberailsConfig): 'ok' | 'needs-input' | 'unconfigured' {
  if (!config.rules.enforceNaming) return 'unconfigured';
  return getEffectiveFileNaming(config) ? 'ok' : 'needs-input';
}

/** @internal Exported for testing. */
export function missingTestsHint(config: ViberailsConfig): string {
  if (!config.rules.enforceMissingTests) return 'not enforced';
  const rootPkg = getRootPackage(config.packages);
  const pattern = rootPkg.structure?.testPattern;
  return pattern ? `enforced (${pattern})` : 'enforced';
}

/** @internal Exported for testing. */
export function coverageHint(config: ViberailsConfig, hasTestRunner: boolean): string {
  if (config.rules.testCoverage === 0) return 'disabled';
  if (!hasTestRunner)
    return `${config.rules.testCoverage}% target (inactive \u2014 no test runner)`;
  const isMonorepo = config.packages.length > 1;
  if (isMonorepo) {
    const withCov = config.packages.filter(
      (p) => (p.rules?.testCoverage ?? config.rules.testCoverage) > 0,
    );
    const exempt = config.packages.length - withCov.length;
    return exempt > 0
      ? `${config.rules.testCoverage}% (${withCov.length}/${config.packages.length} packages, ${exempt} exempt)`
      : `${config.rules.testCoverage}%`;
  }
  return `${config.rules.testCoverage}%`;
}

/** @internal Exported for testing. */
export function aiContextHint(config: ViberailsConfig): string {
  const rootPkg = getRootPackage(config.packages);
  const count = [
    rootPkg.conventions?.componentNaming,
    rootPkg.conventions?.hookNaming,
    rootPkg.conventions?.importAlias,
  ].filter(Boolean).length;
  if (count === 3) return 'all set';
  if (count > 0) return `${count} of 3 conventions`;
  return 'none set \u2014 optional AI guidelines';
}

function aiContextStatus(config: ViberailsConfig): 'ok' | 'partial' | 'unconfigured' {
  const rootPkg = getRootPackage(config.packages);
  const count = [
    rootPkg.conventions?.componentNaming,
    rootPkg.conventions?.hookNaming,
    rootPkg.conventions?.importAlias,
  ].filter(Boolean).length;
  if (count === 3) return 'ok';
  if (count > 0) return 'partial';
  return 'unconfigured';
}

/** @internal Exported for testing. */
export function packageOverridesHint(config: ViberailsConfig): string {
  const rootNaming = getRootPackage(config.packages).conventions?.fileNaming;
  const editable = config.packages.filter((p) => p.path !== '.');
  const customized = editable.filter(
    (p) =>
      p.rules ||
      p.coverage ||
      (p.conventions?.fileNaming !== undefined && p.conventions.fileNaming !== rootNaming),
  ).length;
  return customized > 0
    ? `${editable.length} packages (${customized} customized)`
    : `${editable.length} packages`;
}

/** @internal Exported for testing. */
export function boundariesHint(config: ViberailsConfig, state: InitMenuState): string {
  if (!state.visited.boundaries || !config.rules.enforceBoundaries) return 'not enabled';
  const deny = config.boundaries?.deny;
  if (!deny) return 'enabled';
  const ruleCount = Object.values(deny).reduce((s, a) => s + a.length, 0);
  const pkgCount = Object.keys(deny).length;
  return `${ruleCount} rules across ${pkgCount} packages`;
}

function packageOverridesStatus(config: ViberailsConfig): 'ok' | 'unconfigured' {
  const rootNaming = getRootPackage(config.packages).conventions?.fileNaming;
  const editable = config.packages.filter((p) => p.path !== '.');
  const customized = editable.some(
    (p) =>
      p.rules ||
      p.coverage ||
      (p.conventions?.fileNaming !== undefined && p.conventions.fileNaming !== rootNaming),
  );
  return customized ? 'ok' : 'unconfigured';
}

function statusIcon(status: 'ok' | 'needs-input' | 'partial' | 'unconfigured'): string {
  if (status === 'ok') return chalk.green('\u2713');
  if (status === 'needs-input') return chalk.yellow('?');
  if (status === 'unconfigured') return chalk.dim('-');
  return chalk.yellow('~'); // partial
}

/** @internal Exported for testing. */
export function buildMainMenuOptions(
  config: ViberailsConfig,
  scanResult: ScanResult,
  state: InitMenuState,
): { value: string; label: string; hint?: string }[] {
  const namingStatus = fileNamingStatus(config);
  const coverageStatus =
    config.rules.testCoverage === 0 ? 'unconfigured' : !state.hasTestRunner ? 'partial' : 'ok';
  const missingTestsStatus = config.rules.enforceMissingTests ? 'ok' : 'unconfigured';

  const options: { value: string; label: string; hint?: string }[] = [
    {
      value: 'fileLimits',
      label: `${statusIcon('ok')} Max file size`,
      hint: fileLimitsHint(config),
    },
    {
      value: 'fileNaming',
      label: `${statusIcon(namingStatus)} File naming`,
      hint: fileNamingHint(config, scanResult),
    },
    {
      value: 'missingTests',
      label: `${statusIcon(missingTestsStatus)} Missing tests`,
      hint: missingTestsHint(config),
    },
    {
      value: 'coverage',
      label: `${statusIcon(coverageStatus)} Coverage`,
      hint: coverageHint(config, state.hasTestRunner),
    },
    {
      value: 'aiContext',
      label: `${statusIcon(aiContextStatus(config))} AI context`,
      hint: aiContextHint(config),
    },
  ];

  if (config.packages.length > 1) {
    const bIcon = statusIcon(
      state.visited.boundaries && config.rules.enforceBoundaries ? 'ok' : 'unconfigured',
    );
    const poIcon = statusIcon(packageOverridesStatus(config));
    options.push(
      {
        value: 'packageOverrides',
        label: `${poIcon} Per-package overrides`,
        hint: packageOverridesHint(config),
      },
      { value: 'boundaries', label: `${bIcon} Boundaries`, hint: boundariesHint(config, state) },
    );
  }

  options.push(
    { value: 'reset', label: '  Reset all to defaults' },
    { value: 'review', label: '  Review scan details', hint: 'detected stack & conventions' },
    { value: 'done', label: '  Done \u2014 write config' },
  );

  return options;
}
