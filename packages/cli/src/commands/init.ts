import * as fs from 'node:fs';
import * as path from 'node:path';
import * as clack from '@clack/prompts';
import { compactConfig, generateConfig } from '@viberails/config';
import { scan } from '@viberails/scanner';
import chalk from 'chalk';
import { displayInitSummary, displayRulesPreview, displayScanResults } from '../display.js';
import { formatScanResultsText } from '../display-text.js';
import { applyRuleOverrides } from '../utils/apply-rule-overrides.js';
import {
  checkCoveragePrereqs,
  displayMissingPrereqs,
  promptMissingPrereqs,
} from '../utils/check-prerequisites.js';
import { filterHighConfidence } from '../utils/filter-confidence.js';
import { findProjectRoot } from '../utils/find-project-root.js';
import {
  confirm,
  confirmDangerous,
  promptInitDecision,
  promptIntegrations,
  promptRuleMenu,
} from '../utils/prompt.js';
import { resolveWorkspacePackages } from '../utils/resolve-workspace-packages.js';
import { updateGitignore } from '../utils/update-gitignore.js';
import { writeGeneratedFiles } from '../utils/write-generated-files.js';
import {
  detectHookManager,
  setupClaudeCodeHook,
  setupClaudeMdReference,
  setupGithubAction,
  setupPreCommitHook,
} from './init-hooks.js';
import {
  setupLintHook,
  setupSelectedIntegrations,
  setupTypecheckHook,
} from './init-hooks-extra.js';

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
    console.log(
      `${chalk.yellow('!')} viberails is already initialized.\n` +
        `  Run ${chalk.cyan('viberails config')} to edit rules, ${chalk.cyan('viberails sync')} to update, or ${chalk.cyan('viberails init --force')} to start fresh.`,
    );
    return;
  }
  if (options.yes) return initNonInteractive(projectRoot, configPath);
  await initInteractive(projectRoot, configPath, options);
}

async function initNonInteractive(projectRoot: string, configPath: string): Promise<void> {
  console.log(chalk.dim('Scanning project...'));
  const scanResult = await scan(projectRoot);
  const config = generateConfig(scanResult);

  for (const pkg of config.packages) {
    const pkgMeta = config._meta?.packages?.[pkg.path]?.conventions;
    pkg.conventions = filterHighConfidence(pkg.conventions ?? {}, pkgMeta);
  }

  displayMissingPrereqs(checkCoveragePrereqs(projectRoot, scanResult));

  displayScanResults(scanResult);
  displayRulesPreview(config);

  const exempted = getExemptedPackages(config);
  if (exempted.length > 0) {
    console.log(
      `  ${chalk.dim('Auto-exempted from coverage:')} ${exempted.join(', ')} ${chalk.dim('(types-only)')}`,
    );
  }

  if (config.packages.length > 1) {
    console.log(chalk.dim('Building import graph...'));
    const { buildImportGraph, inferBoundaries } = await import('@viberails/graph');
    const packages = resolveWorkspacePackages(projectRoot, config.packages);
    const graph = await buildImportGraph(projectRoot, { packages, ignore: config.ignore });
    const inferred = inferBoundaries(graph);
    const denyCount = Object.values(inferred.deny).reduce((sum, arr) => sum + arr.length, 0);
    if (denyCount > 0) {
      config.boundaries = inferred;
      config.rules.enforceBoundaries = true;
      console.log(`  Inferred ${denyCount} boundary rules`);
    }
  }

  const compacted = compactConfig(config);
  fs.writeFileSync(configPath, `${JSON.stringify(compacted, null, 2)}\n`);
  writeGeneratedFiles(projectRoot, config, scanResult);
  updateGitignore(projectRoot);

  setupClaudeCodeHook(projectRoot);
  setupClaudeMdReference(projectRoot);
  const rootPkg = config.packages[0];
  const rootPkgPm = rootPkg?.stack?.packageManager ?? 'npm';
  const linter = rootPkg?.stack?.linter?.split('@')[0];
  const isTypeScript = rootPkg?.stack?.language === 'typescript';
  const actionTarget = setupGithubAction(projectRoot, rootPkgPm, {
    linter,
    typecheck: isTypeScript,
  });

  // Skip bare .git/hooks in --yes mode — they're local-only and won't be shared.
  const hookManager = detectHookManager(projectRoot);
  const hasHookManager = hookManager === 'Lefthook' || hookManager === 'Husky';
  const preCommitTarget = hasHookManager ? setupPreCommitHook(projectRoot) : undefined;

  const ok = chalk.green('\u2713');
  const created = [
    `${ok} ${path.basename(configPath)}`,
    `${ok} .viberails/context.md`,
    `${ok} .viberails/scan-result.json`,
    `${ok} .claude/settings.json \u2014 added viberails hook`,
    `${ok} CLAUDE.md \u2014 added @.viberails/context.md reference`,
    preCommitTarget
      ? `${ok} ${preCommitTarget}`
      : `${chalk.yellow('!')} pre-commit hook skipped (install lefthook or husky)`,
    actionTarget ? `${ok} ${actionTarget} \u2014 blocks PRs on violations` : '',
  ].filter(Boolean);

  if (hasHookManager && rootPkg?.stack?.language === 'typescript') setupTypecheckHook(projectRoot);
  if (hasHookManager && linter) setupLintHook(projectRoot, linter);
  console.log(`\nCreated:\n${created.map((f) => `  ${f}`).join('\n')}`);
}

async function initInteractive(
  projectRoot: string,
  configPath: string,
  options: { force?: boolean },
): Promise<void> {
  clack.intro('viberails');

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

  const prereqResult = await promptMissingPrereqs(
    projectRoot,
    checkCoveragePrereqs(projectRoot, scanResult),
  );
  if (prereqResult.disableCoverage) {
    config.rules.testCoverage = 0;
  }

  if (scanResult.statistics.totalFiles === 0) {
    clack.log.warn(
      'No source files detected. Try running from the project root,\n' +
        'or check that source files exist. Run viberails sync after adding files.',
    );
  }

  clack.note(formatScanResultsText(scanResult), 'Scan results');

  const exemptedPkgs = getExemptedPackages(config);
  displayInitSummary(config, exemptedPkgs);

  const decision = await promptInitDecision();

  if (decision === 'customize') {
    const rootPkg = config.packages.find((p) => p.path === '.') ?? config.packages[0];
    const overrides = await promptRuleMenu({
      maxFileLines: config.rules.maxFileLines,
      testCoverage: config.rules.testCoverage,
      enforceMissingTests: config.rules.enforceMissingTests,
      enforceNaming: config.rules.enforceNaming,
      fileNamingValue: rootPkg.conventions?.fileNaming,
      coverageSummaryPath: 'coverage/coverage-summary.json',
      coverageCommand: config.defaults?.coverage?.command,
      packageOverrides: config.packages,
    });

    applyRuleOverrides(config, overrides);
  }

  if (config.packages.length > 1) {
    clack.note(
      'Boundary rules prevent packages from importing where they\n' +
        "shouldn't. viberails scans your existing imports and creates\n" +
        "rules based on what's already working.",
      'Boundaries',
    );
    const shouldInfer = await confirm('Infer boundary rules from import patterns?');

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
        bs.stop(`Inferred ${denyCount} boundary rules`);
        const boundaryLines = Object.entries(inferred.deny)
          .map(([pkg, denied]) => `${pkg} must NOT import from: ${denied.join(', ')}`)
          .join('\n');
        clack.note(boundaryLines, 'Boundary rules');
      } else {
        bs.stop('No boundary rules inferred');
      }
    }
  }

  const hookManager = detectHookManager(projectRoot);
  const rootPkgStack = (config.packages.find((p) => p.path === '.') ?? config.packages[0])?.stack;
  const integrations = await promptIntegrations(projectRoot, hookManager, {
    isTypeScript: rootPkgStack?.language === 'typescript',
    linter: rootPkgStack?.linter?.split('@')[0],
    packageManager: rootPkgStack?.packageManager,
    isWorkspace: config.packages.length > 1,
  });

  const shouldWrite = await confirm('Write configuration and set up selected integrations?');
  if (!shouldWrite) {
    clack.outro('Aborted. No files were written.');
    return;
  }

  const compacted = compactConfig(config);
  fs.writeFileSync(configPath, `${JSON.stringify(compacted, null, 2)}\n`);
  writeGeneratedFiles(projectRoot, config, scanResult);
  updateGitignore(projectRoot);

  const createdFiles: string[] = [
    path.basename(configPath),
    '.viberails/context.md',
    '.viberails/scan-result.json',
    ...setupSelectedIntegrations(projectRoot, integrations, {
      linter: rootPkgStack?.linter?.split('@')[0],
      packageManager: rootPkgStack?.packageManager,
    }),
  ];

  clack.log.success(`Created:\n${createdFiles.map((f) => `  ${f}`).join('\n')}`);
  clack.outro(
    `Done! Next: review viberails.config.json, then run viberails check\n` +
      `  ${chalk.dim('Tip: use')} ${chalk.cyan('viberails check --enforce')} ${chalk.dim('in CI to block PRs on violations.')}`,
  );
}
