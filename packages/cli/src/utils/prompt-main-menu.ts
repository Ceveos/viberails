import * as clack from '@clack/prompts';
import type { ScanResult, ViberailsConfig } from '@viberails/types';
import { formatScanResultsText } from '../display-text.js';
import type { PrereqResult } from './check-prerequisites.js';
import { planCoverageInstall } from './check-prerequisites.js';
import type { DeferredInstall } from './deferred-install.js';
import { getRootPackage } from './get-root-package.js';
import { assertNotCancelled } from './prompt.js';
import { SENTINEL_SKIP } from './prompt-constants.js';
import type { DetectedTools, IntegrationChoice } from './prompt-integrations.js';
import { promptIntegrationsDeferred } from './prompt-integrations.js';
import { buildMainMenuOptions } from './prompt-main-menu-hints.js';
import { normalizePackageOverrides, promptPackageOverrides } from './prompt-package-overrides.js';
import type { RuleOverrides } from './prompt-rules.js';
import { FILE_NAMING_OPTIONS, promptFileLimitsMenu, promptNamingMenu } from './prompt-submenus.js';
import { resolveWorkspacePackages } from './resolve-workspace-packages.js';

export interface InitMenuState {
  visited: { integrations: boolean; boundaries: boolean };
  deferredInstalls: DeferredInstall[];
  integrations?: IntegrationChoice;
  hasTestRunner: boolean;
  hookManager: string | undefined;
}

interface MainMenuOpts {
  hasTestRunner: boolean;
  hookManager: string | undefined;
  coveragePrereqs: PrereqResult[];
  projectRoot: string;
  tools: DetectedTools;
}

// --- Sub-menu handlers ---

async function handleAdvancedNaming(config: ViberailsConfig): Promise<void> {
  const rootPkg = getRootPackage(config.packages);
  const state: RuleOverrides = {
    maxFileLines: config.rules.maxFileLines,
    maxTestFileLines: config.rules.maxTestFileLines,
    testCoverage: config.rules.testCoverage,
    enforceMissingTests: config.rules.enforceMissingTests,
    enforceNaming: config.rules.enforceNaming,
    fileNamingValue: rootPkg.conventions?.fileNaming,
    componentNaming: rootPkg.conventions?.componentNaming,
    hookNaming: rootPkg.conventions?.hookNaming,
    importAlias: rootPkg.conventions?.importAlias,
    coverageSummaryPath: rootPkg.coverage?.summaryPath ?? 'coverage/coverage-summary.json',
    coverageCommand: config.defaults?.coverage?.command,
  };
  await promptNamingMenu(state);
  rootPkg.conventions = rootPkg.conventions ?? {};
  config.rules.enforceNaming = state.enforceNaming;
  if (state.fileNamingValue) {
    rootPkg.conventions.fileNaming = state.fileNamingValue;
  } else {
    delete rootPkg.conventions.fileNaming;
  }
  rootPkg.conventions.componentNaming = state.componentNaming || undefined;
  rootPkg.conventions.hookNaming = state.hookNaming || undefined;
  rootPkg.conventions.importAlias = state.importAlias || undefined;
}

// --- Main menu ---

/**
 * Run the interactive main menu loop for init.
 * Mutates the draft config in place. Returns when user selects Done.
 */
export async function promptMainMenu(
  config: ViberailsConfig,
  scanResult: ScanResult,
  opts: MainMenuOpts,
): Promise<InitMenuState> {
  const originalConfig = structuredClone(config);
  const state: InitMenuState = {
    visited: { integrations: false, boundaries: false },
    deferredInstalls: [],
    hasTestRunner: opts.hasTestRunner,
    hookManager: opts.hookManager,
  };

  while (true) {
    const options = buildMainMenuOptions(config, scanResult, state);
    const choice = await clack.select({ message: 'Configure viberails', options });
    assertNotCancelled(choice);

    if (choice === 'done') {
      if (config.rules.enforceNaming && !getRootPackage(config.packages).conventions?.fileNaming) {
        config.rules.enforceNaming = false;
      }
      break;
    }

    if (choice === 'fileLimits') {
      const s = {
        maxFileLines: config.rules.maxFileLines,
        maxTestFileLines: config.rules.maxTestFileLines,
      };
      await promptFileLimitsMenu(s);
      config.rules.maxFileLines = s.maxFileLines;
      config.rules.maxTestFileLines = s.maxTestFileLines;
    }
    if (choice === 'fileNaming') await handleFileNaming(config, scanResult);
    if (choice === 'missingTests') await handleMissingTests(config);
    if (choice === 'coverage') await handleCoverage(config, state, opts);
    if (choice === 'advancedNaming') await handleAdvancedNaming(config);
    if (choice === 'packageOverrides') await handlePackageOverrides(config);
    if (choice === 'boundaries') await handleBoundaries(config, state, opts);
    if (choice === 'integrations') await handleIntegrations(state, opts);
    if (choice === 'review') clack.note(formatScanResultsText(scanResult), 'Scan details');
    if (choice === 'reset') {
      Object.assign(config, structuredClone(originalConfig));
      state.deferredInstalls = [];
      state.visited = { integrations: false, boundaries: false };
      state.integrations = undefined;
      clack.log.info('Reset all settings to scan-detected defaults.');
    }
  }

  return state;
}

// --- Menu item handlers ---

async function handleFileNaming(config: ViberailsConfig, scanResult: ScanResult): Promise<void> {
  const isMonorepo = config.packages.length > 1;
  if (isMonorepo) {
    const pkgData = scanResult.packages
      .filter((p) => p.conventions.fileNaming && p.conventions.fileNaming.confidence !== 'low')
      .map((p) => ({
        path: p.relativePath,
        naming: p.conventions.fileNaming as NonNullable<typeof p.conventions.fileNaming>,
      }));
    if (pkgData.length > 0) {
      const lines = pkgData.map(
        (p) => `${p.path}: ${p.naming.value} (${Math.round(p.naming.consistency)}%)`,
      );
      clack.note(lines.join('\n'), 'Per-package file naming detected');
    }
  }

  const namingOptions = FILE_NAMING_OPTIONS.map((opt) => {
    if (isMonorepo) {
      const pkgs = scanResult.packages.filter((p) => p.conventions.fileNaming?.value === opt.value);
      const hint =
        pkgs.length > 0 ? `${pkgs.length} package${pkgs.length > 1 ? 's' : ''}` : undefined;
      return { value: opt.value, label: opt.label, hint };
    }
    return { value: opt.value, label: opt.label };
  });

  const rootPkg = getRootPackage(config.packages);
  const selected = await clack.select({
    message: isMonorepo ? 'Default file naming convention' : 'File naming convention',
    options: [...namingOptions, { value: SENTINEL_SKIP, label: "Don't enforce" }],
    initialValue: rootPkg.conventions?.fileNaming ?? SENTINEL_SKIP,
  });
  assertNotCancelled(selected);

  if (selected === SENTINEL_SKIP) {
    config.rules.enforceNaming = false;
    if (rootPkg.conventions) delete rootPkg.conventions.fileNaming;
  } else {
    config.rules.enforceNaming = true;
    rootPkg.conventions = rootPkg.conventions ?? {};
    rootPkg.conventions.fileNaming = selected;
  }
}

async function handleMissingTests(config: ViberailsConfig): Promise<void> {
  const result = await clack.confirm({
    message: 'Require every source file to have a test file?',
    initialValue: config.rules.enforceMissingTests,
  });
  assertNotCancelled(result);
  config.rules.enforceMissingTests = result;
}

async function handleCoverage(
  config: ViberailsConfig,
  state: InitMenuState,
  opts: MainMenuOpts,
): Promise<void> {
  if (!opts.hasTestRunner) {
    clack.log.info('Coverage checks are inactive \u2014 no test runner detected.');
    return;
  }

  const planned = planCoverageInstall(opts.coveragePrereqs);
  if (planned) {
    const choice = await clack.select({
      message: `${planned.label} is not installed. Needed for coverage checks.`,
      options: [
        {
          value: 'install' as const,
          label: 'Install (after final confirmation)',
          hint: planned.command,
        },
        { value: 'disable' as const, label: 'Disable coverage checks' },
        {
          value: 'skip' as const,
          label: 'Skip for now',
          hint: `install later: ${planned.command}`,
        },
      ],
    });
    assertNotCancelled(choice);
    // Clear any previously queued install for this command
    state.deferredInstalls = state.deferredInstalls.filter((d) => d.command !== planned.command);
    if (choice === 'install') {
      planned.onFailure = () => {
        config.rules.testCoverage = 0;
      };
      state.deferredInstalls.push(planned);
    } else if (choice === 'disable') {
      config.rules.testCoverage = 0;
      return;
    }
  }

  const result = await clack.text({
    message: 'Test coverage target (0 = disable)?',
    initialValue: String(config.rules.testCoverage),
    validate: (v) => {
      if (typeof v !== 'string') return 'Enter a number between 0 and 100';
      const n = Number.parseInt(v, 10);
      if (Number.isNaN(n) || n < 0 || n > 100) return 'Enter a number between 0 and 100';
    },
  });
  assertNotCancelled(result);
  config.rules.testCoverage = Number.parseInt(result, 10);
}

async function handlePackageOverrides(config: ViberailsConfig): Promise<void> {
  const rootPkg = getRootPackage(config.packages);
  config.packages = await promptPackageOverrides(config.packages, {
    fileNamingValue: rootPkg.conventions?.fileNaming,
    maxFileLines: config.rules.maxFileLines,
    testCoverage: config.rules.testCoverage,
    coverageSummaryPath: rootPkg.coverage?.summaryPath ?? 'coverage/coverage-summary.json',
    coverageCommand: config.defaults?.coverage?.command,
  });
  normalizePackageOverrides(config.packages);
}

async function handleBoundaries(
  config: ViberailsConfig,
  state: InitMenuState,
  opts: MainMenuOpts,
): Promise<void> {
  const shouldInfer = await clack.confirm({
    message: 'Infer boundary rules from current import patterns?',
    initialValue: false,
  });
  assertNotCancelled(shouldInfer);
  state.visited.boundaries = true;
  if (!shouldInfer) {
    config.rules.enforceBoundaries = false;
    return;
  }
  const bs = clack.spinner();
  bs.start('Building import graph...');
  try {
    const { buildImportGraph, inferBoundaries } = await import('@viberails/graph');
    const packages = resolveWorkspacePackages(opts.projectRoot, config.packages);
    const graph = await buildImportGraph(opts.projectRoot, { packages, ignore: config.ignore });
    const inferred = inferBoundaries(graph);
    const denyCount = Object.values(inferred.deny).reduce((sum, arr) => sum + arr.length, 0);
    if (denyCount > 0) {
      config.boundaries = inferred;
      config.rules.enforceBoundaries = true;
      const pkgCount = Object.keys(inferred.deny).length;
      bs.stop(`Inferred ${denyCount} boundary rules across ${pkgCount} packages`);
    } else {
      bs.stop('No boundary rules inferred');
    }
  } catch (err) {
    bs.stop('Failed to build import graph');
    clack.log.warn(`Boundary inference failed: ${err instanceof Error ? err.message : err}`);
  }
}

async function handleIntegrations(state: InitMenuState, opts: MainMenuOpts): Promise<void> {
  const result = await promptIntegrationsDeferred(
    state.hookManager,
    opts.tools,
    opts.tools.packageManager,
    opts.tools.isWorkspace,
    opts.projectRoot,
  );
  state.visited.integrations = true;
  state.integrations = result.choice;
  state.deferredInstalls = state.deferredInstalls.filter((d) => !d.command.includes('lefthook'));
  if (result.lefthookInstall) {
    state.deferredInstalls.push(result.lefthookInstall);
  }
}
