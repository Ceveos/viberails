import * as fs from 'node:fs';
import * as path from 'node:path';
import * as clack from '@clack/prompts';
import { compactConfig, generateConfig } from '@viberails/config';
import { scan } from '@viberails/scanner';
import chalk from 'chalk';
import { displayInitOverview, displaySetupPlan } from '../display.js';
import { formatScanResultsText } from '../display-text.js';
import { applyRuleOverrides } from '../utils/apply-rule-overrides.js';
import { checkCoveragePrereqs, promptMissingPrereqs } from '../utils/check-prerequisites.js';
import { findProjectRoot } from '../utils/find-project-root.js';
import {
  confirm,
  confirmDangerous,
  promptExistingConfigAction,
  promptInitDecision,
  promptIntegrations,
  promptRuleMenu,
} from '../utils/prompt.js';
import { resolveWorkspacePackages } from '../utils/resolve-workspace-packages.js';
import { updateGitignore } from '../utils/update-gitignore.js';
import { writeGeneratedFiles } from '../utils/write-generated-files.js';
import { configCommand } from './config.js';
import { detectHookManager } from './init-hooks.js';
import { setupSelectedIntegrations } from './init-hooks-extra.js';
import { initNonInteractive } from './init-non-interactive.js';

const CONFIG_FILE = 'viberails.config.json';

function getExemptedPackages(config: import('@viberails/types').ViberailsConfig): string[] {
  return config.packages
    .filter((pkg) => pkg.rules?.testCoverage === 0 && pkg.path !== '.')
    .map((pkg) => pkg.path);
}

/** Run the viberails init flow. */
export async function initCommand(
  options: { yes?: boolean; force?: boolean },
  cwd?: string,
): Promise<void> {
  const projectRoot = findProjectRoot(cwd ?? process.cwd());
  if (!projectRoot) {
    throw new Error(
      'No package.json found. Make sure you are inside a JS/TS project, then run:\n  npx viberails',
    );
  }

  const configPath = path.join(projectRoot, CONFIG_FILE);
  if (fs.existsSync(configPath) && !options.force) {
    if (!options.yes) {
      return initInteractive(projectRoot, configPath, options);
    }
    console.log(
      `${chalk.yellow('!')} viberails is already initialized.\n` +
        `  Run ${chalk.cyan('viberails')} to review or edit the existing setup, ${chalk.cyan('viberails sync')} to update generated files, or ${chalk.cyan('viberails init --force')} to replace it.`,
    );
    return;
  }
  if (options.yes) return initNonInteractive(projectRoot, configPath);
  await initInteractive(projectRoot, configPath, options);
}

async function initInteractive(
  projectRoot: string,
  configPath: string,
  options: { force?: boolean },
): Promise<void> {
  clack.intro('viberails');
  const replacingExistingConfig = fs.existsSync(configPath);

  if (fs.existsSync(configPath) && !options.force) {
    const action = await promptExistingConfigAction(path.basename(configPath));
    if (action === 'cancel') {
      clack.outro('Aborted. No files were written.');
      return;
    }
    if (action === 'edit') {
      await configCommand({ suppressIntro: true }, projectRoot);
      return;
    }
    options.force = true;
  }

  if (fs.existsSync(configPath) && options.force) {
    const replace = await confirmDangerous(
      `${path.basename(configPath)} already exists and will be replaced. Continue?`,
    );
    if (!replace) {
      clack.outro('Aborted. No files were written.');
      return;
    }
  }

  const s = clack.spinner();
  s.start('Scanning project...');
  const scanResult = await scan(projectRoot);
  const config = generateConfig(scanResult);
  s.stop('Scan complete');

  if (scanResult.statistics.totalFiles === 0) {
    clack.log.warn(
      'No source files detected. Try running from the project root,\n' +
        'or check that source files exist. Run viberails sync after adding files.',
    );
  }

  const exemptedPkgs = getExemptedPackages(config);
  let decision: 'accept' | 'customize';
  while (true) {
    displayInitOverview(scanResult, config, exemptedPkgs);
    const nextDecision = await promptInitDecision();
    if (nextDecision === 'review') {
      clack.note(formatScanResultsText(scanResult), 'Detected details');
      continue;
    }
    decision = nextDecision;
    break;
  }

  if (decision === 'customize') {
    const { resolveNamingDefault } = await import('../utils/prompt-naming-default.js');
    await resolveNamingDefault(config, scanResult);

    const rootPkg = config.packages.find((p) => p.path === '.') ?? config.packages[0];
    const overrides = await promptRuleMenu({
      maxFileLines: config.rules.maxFileLines,
      maxTestFileLines: config.rules.maxTestFileLines,
      testCoverage: config.rules.testCoverage,
      enforceMissingTests: config.rules.enforceMissingTests,
      enforceNaming: config.rules.enforceNaming,
      fileNamingValue: rootPkg.conventions?.fileNaming,
      componentNaming: rootPkg.conventions?.componentNaming,
      hookNaming: rootPkg.conventions?.hookNaming,
      importAlias: rootPkg.conventions?.importAlias,
      coverageSummaryPath: 'coverage/coverage-summary.json',
      coverageCommand: config.defaults?.coverage?.command,
      packageOverrides: config.packages,
    });

    applyRuleOverrides(config, overrides);
  }

  if (config.packages.length > 1) {
    clack.note(
      'Optional for monorepos. viberails can infer package boundaries\n' +
        'from imports that already work today, so you start with rules\n' +
        'that match the current codebase.',
      'Boundaries',
    );
    const shouldInfer = await confirm('Infer boundary rules from current import patterns?');

    if (shouldInfer) {
      const bs = clack.spinner();
      bs.start('Building import graph...');
      const { buildImportGraph, inferBoundaries } = await import('@viberails/graph');
      const packages = resolveWorkspacePackages(projectRoot, config.packages);
      const graph = await buildImportGraph(projectRoot, { packages, ignore: config.ignore });
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
    }
  }

  // Prerequisites: coverage provider + hook manager
  const hookManager = detectHookManager(projectRoot);
  const coveragePrereqs = checkCoveragePrereqs(projectRoot, scanResult);
  const hasMissingPrereqs = coveragePrereqs.some((p) => !p.installed) || !hookManager;
  if (hasMissingPrereqs) {
    clack.log.info('Some dependencies are needed for full functionality.');
  }
  const prereqResult = await promptMissingPrereqs(projectRoot, coveragePrereqs);
  if (prereqResult.disableCoverage) {
    config.rules.testCoverage = 0;
  }

  const rootPkgStack = (config.packages.find((p) => p.path === '.') ?? config.packages[0])?.stack;
  const integrations = await promptIntegrations(projectRoot, hookManager, {
    isTypeScript: rootPkgStack?.language?.split('@')[0] === 'typescript',
    linter: rootPkgStack?.linter?.split('@')[0],
    packageManager: rootPkgStack?.packageManager?.split('@')[0],
    isWorkspace: config.packages.length > 1,
  });

  displaySetupPlan(config, integrations, {
    replacingExistingConfig,
    configFile: path.basename(configPath),
  });

  const shouldWrite = await confirm('Apply this setup?');
  if (!shouldWrite) {
    clack.outro('Aborted. No files were written.');
    return;
  }

  const ws = clack.spinner();
  ws.start('Writing configuration...');

  const compacted = compactConfig(config);
  fs.writeFileSync(configPath, `${JSON.stringify(compacted, null, 2)}\n`);
  writeGeneratedFiles(projectRoot, config, scanResult);
  updateGitignore(projectRoot);

  ws.stop('Configuration written');

  const ok = chalk.green('\u2713');
  clack.log.step(`${ok} ${path.basename(configPath)}`);
  clack.log.step(`${ok} .viberails/context.md`);
  clack.log.step(`${ok} .viberails/scan-result.json`);

  setupSelectedIntegrations(projectRoot, integrations, {
    linter: rootPkgStack?.linter?.split('@')[0],
    packageManager: rootPkgStack?.packageManager?.split('@')[0],
  });

  clack.outro(
    `Done! Next: review viberails.config.json, then run viberails check\n` +
      `  ${chalk.dim('Tip: use')} ${chalk.cyan('viberails check --enforce')} ${chalk.dim('in CI to block PRs on violations.')}`,
  );
}
