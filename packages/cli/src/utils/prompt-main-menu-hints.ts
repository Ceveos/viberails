import type { ScanResult, ViberailsConfig } from '@viberails/types';
import { getRootPackage } from './get-root-package.js';
import type { InitMenuState } from './prompt-main-menu.js';

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
export function fileNamingStatus(config: ViberailsConfig): 'ok' | 'needs-input' | 'disabled' {
  if (!config.rules.enforceNaming) return 'disabled';
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
  const parts: string[] = [];
  if (rootPkg.conventions?.componentNaming)
    parts.push(`${rootPkg.conventions.componentNaming} components`);
  if (rootPkg.conventions?.hookNaming) parts.push(`${rootPkg.conventions.hookNaming} hooks`);
  if (rootPkg.conventions?.importAlias) parts.push(rootPkg.conventions.importAlias);
  return parts.length > 0 ? parts.join(', ') : 'component, hook, and alias conventions';
}

/** @internal Exported for testing. */
export function integrationsHint(state: InitMenuState): string {
  if (!state.visited.integrations || !state.integrations)
    return 'not configured \u2014 select to set up';
  const items: string[] = [];
  if (state.integrations.preCommitHook) items.push('pre-commit');
  if (state.integrations.typecheckHook) items.push('typecheck');
  if (state.integrations.lintHook) items.push('lint');
  if (state.integrations.claudeCodeHook) items.push('Claude');
  if (state.integrations.claudeMdRef) items.push('CLAUDE.md');
  if (state.integrations.githubAction) items.push('CI');
  return items.length > 0 ? items.join(' \u00b7 ') : 'none selected';
}

/** @internal Exported for testing. */
export function packageOverridesHint(config: ViberailsConfig): string {
  const editable = config.packages.filter((p) => p.path !== '.');
  const customized = editable.filter((p) => p.conventions || p.rules || p.coverage).length;
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

function statusIcon(status: 'ok' | 'needs-input' | 'disabled' | 'none'): string {
  if (status === 'ok') return '\u2713';
  if (status === 'needs-input') return '?';
  if (status === 'disabled') return '~';
  return ' ';
}

/** @internal Exported for testing. */
export function buildMainMenuOptions(
  config: ViberailsConfig,
  scanResult: ScanResult,
  state: InitMenuState,
): { value: string; label: string; hint?: string }[] {
  const namingStatus = fileNamingStatus(config);
  const coverageStatus =
    config.rules.testCoverage === 0 ? 'disabled' : !state.hasTestRunner ? 'disabled' : 'ok';
  const missingTestsStatus = config.rules.enforceMissingTests ? 'ok' : 'disabled';

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
    { value: 'advancedNaming', label: '  Advanced naming', hint: advancedNamingHint(config) },
  ];

  if (config.packages.length > 1) {
    const bIcon =
      state.visited.boundaries && config.rules.enforceBoundaries ? statusIcon('ok') : '  ';
    options.push(
      {
        value: 'packageOverrides',
        label: '  Per-package overrides',
        hint: packageOverridesHint(config),
      },
      { value: 'boundaries', label: `${bIcon} Boundaries`, hint: boundariesHint(config, state) },
    );
  }

  const iIcon = state.visited.integrations ? statusIcon('ok') : '  ';
  options.push(
    { value: 'integrations', label: `${iIcon} Integrations`, hint: integrationsHint(state) },
    { value: 'reset', label: '  Reset all to defaults' },
    { value: 'review', label: '  Review scan details' },
    { value: 'done', label: '  Done \u2014 write config' },
  );

  return options;
}
