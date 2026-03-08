import * as fs from 'node:fs';
import * as path from 'node:path';
import * as clack from '@clack/prompts';
import { compactConfig, generateConfig } from '@viberails/config';
import { scan } from '@viberails/scanner';
import type { ConfigConventions } from '@viberails/types';
import chalk from 'chalk';
import { displayRulesPreview, displayScanResults } from '../display.js';
import { formatRulesText, formatScanResultsText } from '../display-text.js';
import { findProjectRoot } from '../utils/find-project-root.js';
import {
  confirm,
  confirmDangerous,
  promptInitDecision,
  promptIntegrations,
  promptRuleMenu,
} from '../utils/prompt.js';
import { resolveWorkspacePackages } from '../utils/resolve-workspace-packages.js';
import { writeGeneratedFiles } from '../utils/write-generated-files.js';
import {
  detectHookManager,
  setupClaudeCodeHook,
  setupClaudeMdReference,
  setupPreCommitHook,
} from './init-hooks.js';

const CONFIG_FILE = 'viberails.config.json';

/**
 * Filter conventions to only include high-confidence entries (using _meta).
 */
function filterHighConfidence(
  conventions: ConfigConventions,
  meta?: Record<string, { confidence: string }>,
): ConfigConventions {
  if (!meta) return conventions;
  const filtered: ConfigConventions = {};
  for (const [key, value] of Object.entries(conventions)) {
    if (value === undefined) continue;
    const convMeta = meta[key];
    if (!convMeta || convMeta.confidence === 'high') {
      filtered[key as keyof ConfigConventions] = value;
    }
  }
  return filtered;
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

  // === Non-interactive path: console.log only, no clack, no hooks ===
  if (options.yes) {
    console.log(chalk.dim('Scanning project...'));
    const scanResult = await scan(projectRoot);
    const config = generateConfig(scanResult);

    // Filter to high-confidence conventions only in --yes mode (all packages)
    for (const pkg of config.packages) {
      const pkgMeta = config._meta?.packages?.[pkg.path]?.conventions;
      pkg.conventions = filterHighConfidence(pkg.conventions ?? {}, pkgMeta);
    }

    displayScanResults(scanResult);
    displayRulesPreview(config);

    // Auto-infer boundaries for monorepos
    if (config.packages.length > 1) {
      console.log(chalk.dim('Building import graph...'));
      const { buildImportGraph, inferBoundaries } = await import('@viberails/graph');
      const packages = resolveWorkspacePackages(projectRoot, config.packages);
      const graph = await buildImportGraph(projectRoot, {
        packages,
        ignore: config.ignore,
      });
      const inferred = inferBoundaries(graph);
      const denyCount = Object.values(inferred.deny).reduce((sum, arr) => sum + arr.length, 0);
      if (denyCount > 0) {
        config.boundaries = inferred;
        config.rules.enforceBoundaries = true;
        console.log(`  Inferred ${denyCount} boundary rules`);
      }
    }

    // Write files (compact before writing)
    const compacted = compactConfig(config);
    fs.writeFileSync(configPath, `${JSON.stringify(compacted, null, 2)}\n`);
    writeGeneratedFiles(projectRoot, config, scanResult);
    updateGitignore(projectRoot);

    // Set up integrations automatically in --yes mode
    setupClaudeCodeHook(projectRoot);
    setupClaudeMdReference(projectRoot);
    setupPreCommitHook(projectRoot);

    console.log(`\nCreated:`);
    console.log(`  ${chalk.green('\u2713')} ${CONFIG_FILE}`);
    console.log(`  ${chalk.green('\u2713')} .viberails/context.md`);
    console.log(`  ${chalk.green('\u2713')} .viberails/scan-result.json`);
    console.log(`  ${chalk.green('\u2713')} .claude/settings.json \u2014 added viberails hook`);
    console.log(
      `  ${chalk.green('\u2713')} CLAUDE.md \u2014 added @.viberails/context.md reference`,
    );
    console.log(`  ${chalk.green('\u2713')} pre-commit hook`);
    console.log(
      `\n${chalk.dim('Tip: use')} ${chalk.cyan('viberails check --enforce')} ${chalk.dim('in CI to block PRs on violations.')}`,
    );
    return;
  }

  // === Interactive path: all clack ===
  clack.intro('viberails');

  if (fs.existsSync(configPath) && options.force) {
    const replace = await confirmDangerous(
      `${CONFIG_FILE} already exists and will be replaced. Continue?`,
    );
    if (!replace) {
      clack.outro('Aborted. No files were written.');
      return;
    }
  }

  // 3. Scan with spinner
  const s = clack.spinner();
  s.start('Scanning project...');
  const scanResult = await scan(projectRoot);
  const config = generateConfig(scanResult);
  s.stop('Scan complete');

  // 4. Sparse project warning
  if (scanResult.statistics.totalFiles === 0) {
    clack.log.warn(
      'No source files detected. viberails will generate context\n' +
        'with minimal content. Run viberails sync after adding files.',
    );
  }

  // 5. Show scan results and rules as separate note boxes
  const resultsText = formatScanResultsText(scanResult);
  clack.note(resultsText, 'Scan results');

  const rulesText = formatRulesText(config).join('\n');
  clack.note(rulesText, 'Rules');

  // 6. Accept or Customize
  const decision = await promptInitDecision();

  if (decision === 'customize') {
    const rootPkgBeforeCustomize =
      config.packages.find((p) => p.path === '.') ?? config.packages[0];
    const overrides = await promptRuleMenu({
      maxFileLines: config.rules.maxFileLines,
      testCoverage: config.rules.testCoverage,
      enforceNaming: config.rules.enforceNaming,
      fileNamingValue: rootPkgBeforeCustomize.conventions?.fileNaming,
      coverageSummaryPath: 'coverage/coverage-summary.json',
      coverageCommand: undefined,
      packageOverrides: config.packages,
    });

    if (overrides.packageOverrides) {
      config.packages = overrides.packageOverrides;
    }

    config.rules.maxFileLines = overrides.maxFileLines;
    config.rules.testCoverage = overrides.testCoverage;
    config.rules.enforceNaming = overrides.enforceNaming;

    // Seed package coverage defaults so compactConfig can extract shared defaults.coverage.
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
      const rootPkg = config.packages.find((p) => p.path === '.') ?? config.packages[0];
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

  // 7. Boundary inference (monorepo only)
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
      const graph = await buildImportGraph(projectRoot, {
        packages,
        ignore: config.ignore,
      });
      const inferred = inferBoundaries(graph);
      const denyCount = Object.values(inferred.deny).reduce((sum, arr) => sum + arr.length, 0);
      if (denyCount > 0) {
        config.boundaries = inferred;
        config.rules.enforceBoundaries = true;
        bs.stop(`Inferred ${denyCount} boundary rules`);

        // Show inferred boundaries before saving
        const boundaryLines = Object.entries(inferred.deny)
          .map(([pkg, denied]) => `${pkg} must NOT import from: ${denied.join(', ')}`)
          .join('\n');
        clack.note(boundaryLines, 'Boundary rules');
      } else {
        bs.stop('No boundary rules inferred');
      }
    }
  }

  // 8. Integration selection
  const hookManager = detectHookManager(projectRoot);
  const integrations = await promptIntegrations(hookManager);

  const shouldWrite = await confirm('Write configuration and set up selected integrations?');
  if (!shouldWrite) {
    clack.outro('Aborted. No files were written.');
    return;
  }

  // 9. Write config (compact before writing)
  const compacted = compactConfig(config);
  fs.writeFileSync(configPath, `${JSON.stringify(compacted, null, 2)}\n`);

  // 11. Generate context and scan-result.json
  writeGeneratedFiles(projectRoot, config, scanResult);

  // 12. Update .gitignore
  updateGitignore(projectRoot);

  // 13. Set up hooks based on selection
  const createdFiles: string[] = [
    CONFIG_FILE,
    '.viberails/context.md',
    '.viberails/scan-result.json',
  ];

  if (integrations.preCommitHook) {
    setupPreCommitHook(projectRoot);
    if (hookManager === 'Lefthook') {
      createdFiles.push(`lefthook.yml \u2014 added viberails pre-commit`);
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

  // 14. Summary
  clack.log.success(`Created:\n${createdFiles.map((f) => `  ${f}`).join('\n')}`);

  clack.outro(
    `Done! Next: review viberails.config.json, then run viberails check\n` +
      `  ${chalk.dim('Tip: use')} ${chalk.cyan('viberails check --enforce')} ${chalk.dim('in CI to block PRs on violations.')}`,
  );
}

/**
 * Append viberails entries to .gitignore if not already present.
 * Only scan-result.json is ignored — context.md should be committed
 * so AI agents can read the enforced rules.
 */
function updateGitignore(projectRoot: string): void {
  const gitignorePath = path.join(projectRoot, '.gitignore');
  let content = '';

  if (fs.existsSync(gitignorePath)) {
    content = fs.readFileSync(gitignorePath, 'utf-8');
  }

  if (!content.includes('.viberails/scan-result.json')) {
    const block = '\n# viberails\n.viberails/scan-result.json\n';
    const prefix = content.length === 0 ? '' : `${content.trimEnd()}\n`;
    fs.writeFileSync(gitignorePath, `${prefix}${block}`);
  }
}
