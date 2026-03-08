import * as fs from 'node:fs';
import * as path from 'node:path';
import * as clack from '@clack/prompts';
import { compactConfig, generateConfig } from '@viberails/config';
import { scan } from '@viberails/scanner';
import chalk from 'chalk';
import { displayRulesPreview, displayScanResults } from '../display.js';
import { formatRulesText, formatScanResultsText } from '../display-text.js';
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
  setupPreCommitHook,
} from './init-hooks.js';

const CONFIG_FILE = 'viberails.config.json';

function getExemptedPackages(config: import('@viberails/types').ViberailsConfig): string[] {
  return config.packages
    .filter((pkg) => pkg.rules?.testCoverage === 0 && pkg.path !== '.')
    .map((pkg) => pkg.path);
}

/**
 * Run the viberails init flow.
 *
 * @param options - CLI options
 * @param cwd - Working directory override (for testing)
 */
export async function initCommand(
  options: { yes?: boolean; force?: boolean },
  cwd?: string,
): Promise<void> {
  const startDir = cwd ?? process.cwd();

  // 1. Find project root
  const projectRoot = findProjectRoot(startDir);
  if (!projectRoot) {
    throw new Error(
      'No package.json found in this directory or any parent.\n\n' +
        'Make sure you are inside a JavaScript or TypeScript project, then run:\n' +
        '  npx viberails',
    );
  }

  // 2. Check for existing config (early exit — no clack)
  const configPath = path.join(projectRoot, CONFIG_FILE);
  if (fs.existsSync(configPath) && !options.force) {
    console.log(
      `${chalk.yellow('!')} viberails is already initialized.\n` +
        `  Run ${chalk.cyan('viberails sync')} to update, or ${chalk.cyan('viberails init --force')} to start fresh.`,
    );
    return;
  }

  if (options.yes) {
    await initNonInteractive(projectRoot, configPath);
    return;
  }

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
  const preCommitTarget = setupPreCommitHook(projectRoot);

  console.log(`\nCreated:`);
  console.log(`  ${chalk.green('\u2713')} ${path.basename(configPath)}`);
  console.log(`  ${chalk.green('\u2713')} .viberails/context.md`);
  console.log(`  ${chalk.green('\u2713')} .viberails/scan-result.json`);
  console.log(`  ${chalk.green('\u2713')} .claude/settings.json \u2014 added viberails hook`);
  console.log(`  ${chalk.green('\u2713')} CLAUDE.md \u2014 added @.viberails/context.md reference`);
  if (preCommitTarget) {
    console.log(`  ${chalk.green('\u2713')} ${preCommitTarget}`);
  } else {
    console.log(`  ${chalk.yellow('!')} pre-commit hook skipped (no .git / hook manager found)`);
  }
  console.log(
    `\n${chalk.dim('Tip: use')} ${chalk.cyan('viberails check --enforce')} ${chalk.dim('in CI to block PRs on violations.')}`,
  );
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

  if (scanResult.statistics.totalFiles === 0) {
    clack.log.warn(
      'No source files detected. Try running from the project root,\n' +
        'or check that source files exist. Run viberails sync after adding files.',
    );
  }

  clack.note(formatScanResultsText(scanResult), 'Scan results');

  const interactiveExempted = getExemptedPackages(config);
  const rulesLines = formatRulesText(config);
  if (interactiveExempted.length > 0) {
    rulesLines.push(`Auto-exempted from coverage: ${interactiveExempted.join(', ')} (types-only)`);
  }
  clack.note(rulesLines.join('\n'), 'Rules');

  const decision = await promptInitDecision();

  if (decision === 'customize') {
    const rootPkg = config.packages.find((p) => p.path === '.') ?? config.packages[0];
    const overrides = await promptRuleMenu({
      maxFileLines: config.rules.maxFileLines,
      testCoverage: config.rules.testCoverage,
      enforceNaming: config.rules.enforceNaming,
      fileNamingValue: rootPkg.conventions?.fileNaming,
      coverageSummaryPath: 'coverage/coverage-summary.json',
      coverageCommand: config.defaults?.coverage?.command,
      packageOverrides: config.packages,
    });

    if (overrides.packageOverrides) config.packages = overrides.packageOverrides;
    config.rules.maxFileLines = overrides.maxFileLines;
    config.rules.testCoverage = overrides.testCoverage;
    config.rules.enforceNaming = overrides.enforceNaming;

    for (const pkg of config.packages) {
      pkg.coverage = pkg.coverage ?? {};
      if (pkg.coverage.summaryPath === undefined) {
        pkg.coverage.summaryPath = overrides.coverageSummaryPath;
      }
      if (pkg.coverage.command === undefined && overrides.coverageCommand) {
        pkg.coverage.command = overrides.coverageCommand;
      }
    }

    if (overrides.fileNamingValue) {
      const oldNaming = rootPkg.conventions?.fileNaming;
      rootPkg.conventions = rootPkg.conventions ?? {};
      rootPkg.conventions.fileNaming = overrides.fileNamingValue;
      if (oldNaming && oldNaming !== overrides.fileNamingValue) {
        for (const pkg of config.packages) {
          if (pkg.conventions?.fileNaming === oldNaming) {
            pkg.conventions.fileNaming = overrides.fileNamingValue;
          }
        }
      }
    }
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
  const integrations = await promptIntegrations(hookManager);

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
  ];

  if (integrations.preCommitHook) {
    const preCommitTarget = setupPreCommitHook(projectRoot);
    if (preCommitTarget) {
      createdFiles.push(`${preCommitTarget} \u2014 added viberails pre-commit`);
    } else {
      createdFiles.push('pre-commit hook skipped (no .git / hook manager found)');
    }
  }
  if (integrations.claudeCodeHook) {
    setupClaudeCodeHook(projectRoot);
    createdFiles.push('.claude/settings.json \u2014 added viberails hook');
  }
  if (integrations.claudeMdRef) {
    setupClaudeMdReference(projectRoot);
    createdFiles.push('CLAUDE.md \u2014 added @.viberails/context.md reference');
  }

  clack.log.success(`Created:\n${createdFiles.map((f) => `  ${f}`).join('\n')}`);
  clack.outro(
    `Done! Next: review viberails.config.json, then run viberails check\n` +
      `  ${chalk.dim('Tip: use')} ${chalk.cyan('viberails check --enforce')} ${chalk.dim('in CI to block PRs on violations.')}`,
  );
}
