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

/** @internal Exported for testing. */
export function fileNamingHint(config: ViberailsConfig, scanResult: ScanResult): string {
  const rootPkg = getRootPackage(config.packages);
  const naming = rootPkg.conventions?.fileNaming;
  if (!config.rules.enforceNaming) return 'not enforced';
  if (naming) {
    const detected = scanResult.packages.some(
      (p) =>
        p.conventions.fileNaming?.value === naming &&
        p.conventions.fileNaming.confidence === 'high',
    );
    return detected ? `${naming} (detected)` : naming;
  }
  return 'mixed \u2014 will not enforce if skipped';
}

/** @internal Exported for testing. */
export function fileNamingStatus(config: ViberailsConfig): 'ok' | 'needs-input' | 'unconfigured' {
  if (!config.rules.enforceNaming) return 'unconfigured';
  const rootPkg = getRootPackage(config.packages);
  return rootPkg.conventions?.fileNaming ? 'ok' : 'needs-input';
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
export function advancedNamingHint(config: ViberailsConfig): string {
  const rootPkg = getRootPackage(config.packages);
  if (!config.rules.enforceNaming) return 'not enforced';
  const ok = chalk.green('\u2713');
  const no = chalk.dim('\u2717');
  const parts: string[] = [
    `${rootPkg.conventions?.fileNaming ? ok : no} file naming`,
    `${rootPkg.conventions?.componentNaming ? ok : no} components`,
    `${rootPkg.conventions?.hookNaming ? ok : no} hooks`,
    `${rootPkg.conventions?.importAlias ? ok : no} alias`,
  ];
  return parts.join(chalk.dim(', '));
}

/** @internal Exported for testing. */
export function integrationsHint(state: InitMenuState): string {
  if (!state.visited.integrations || !state.integrations)
    return 'not configured \u2014 select to set up';
  const items: string[] = [];
  if (state.integrations.preCommitHook) items.push(chalk.green('pre-commit'));
  if (state.integrations.typecheckHook) items.push(chalk.green('typecheck'));
  if (state.integrations.lintHook) items.push(chalk.green('lint'));
  if (state.integrations.claudeCodeHook) items.push(chalk.green('Claude'));
  if (state.integrations.claudeMdRef) items.push(chalk.green('CLAUDE.md'));
  if (state.integrations.githubAction) items.push(chalk.green('CI'));
  return items.length > 0 ? items.join(chalk.dim(' \u00b7 ')) : 'none selected';
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

function advancedNamingStatus(config: ViberailsConfig): 'ok' | 'partial' | 'unconfigured' {
  if (!config.rules.enforceNaming) return 'unconfigured';
  const rootPkg = getRootPackage(config.packages);
  const hasFile = !!rootPkg.conventions?.fileNaming;
  const hasComp = !!rootPkg.conventions?.componentNaming;
  const hasHook = !!rootPkg.conventions?.hookNaming;
  const hasAlias = !!rootPkg.conventions?.importAlias;
  if (hasFile && hasComp && hasHook && hasAlias) return 'ok';
  if (hasFile || hasComp || hasHook || hasAlias) return 'partial';
  return 'unconfigured';
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
      label: `${statusIcon(namingStatus)} Default file naming`,
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
      value: 'advancedNaming',
      label: `${statusIcon(advancedNamingStatus(config))} Advanced naming`,
      hint: advancedNamingHint(config),
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

  const iIcon = state.visited.integrations ? statusIcon('ok') : statusIcon('unconfigured');
  options.push(
    { value: 'integrations', label: `${iIcon} Integrations`, hint: integrationsHint(state) },
    { value: 'reset', label: '  Reset all to defaults' },
    { value: 'review', label: '  Review scan details', hint: 'detected stack & conventions' },
    { value: 'done', label: '  Done \u2014 write config' },
  );

  return options;
}
