import * as fs from 'node:fs';
import * as path from 'node:path';
import * as clack from '@clack/prompts';
import { generateConfig } from '@viberails/config';
import { scan } from '@viberails/scanner';
import type { ConfigConventions, ConventionValue, ViberailsConfig } from '@viberails/types';
import chalk from 'chalk';
import { formatScanResultsText } from '../display-text.js';
import { displayRulesPreview, displayScanResults } from '../display.js';
import { findProjectRoot } from '../utils/find-project-root.js';
import {
  confirm,
  promptInitDecision,
  promptIntegrations,
  promptRuleCustomization,
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
 * Filter a ConfigConventions object to only include high-confidence entries.
 */
function filterHighConfidence(conventions: ConfigConventions): ConfigConventions {
  const filtered: ConfigConventions = {};
  for (const [key, value] of Object.entries(conventions)) {
    if (value === undefined) continue;
    if (typeof value === 'string') {
      filtered[key as keyof ConfigConventions] = value;
    } else if (value._confidence === 'high') {
      filtered[key as keyof ConfigConventions] = value as ConventionValue;
    }
  }
  return filtered;
}

/**
 * Extract the string value from a ConventionValue.
 */
function getConventionStr(
  cv: string | { value: string; _confidence: string; _consistency: number } | undefined,
): string | undefined {
  if (!cv) return undefined;
  return typeof cv === 'string' ? cv : cv.value;
}

/**
 * Check if a monorepo config has per-package convention overrides.
 */
function hasConventionOverrides(config: ViberailsConfig): boolean {
  if (!config.packages || config.packages.length === 0) return false;
  return config.packages.some((pkg) => pkg.conventions && Object.keys(pkg.conventions).length > 0);
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
    config.conventions = filterHighConfidence(config.conventions);

    displayScanResults(scanResult);
    displayRulesPreview(config);

    // Auto-infer boundaries for monorepos
    if (config.workspace?.packages && config.workspace.packages.length > 0) {
      console.log(chalk.dim('Building import graph...'));
      const { buildImportGraph, inferBoundaries } = await import('@viberails/graph');
      const packages = resolveWorkspacePackages(projectRoot, config.workspace);
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

    // Write files
    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
    writeGeneratedFiles(projectRoot, config, scanResult);
    updateGitignore(projectRoot);

    // Always append CLAUDE.md reference in --yes mode (non-destructive)
    setupClaudeMdReference(projectRoot);

    console.log(`\nCreated:`);
    console.log(`  ${chalk.green('\u2713')} ${CONFIG_FILE}`);
    console.log(`  ${chalk.green('\u2713')} .viberails/context.md`);
    console.log(`  ${chalk.green('\u2713')} .viberails/scan-result.json`);
    return;
  }

  // === Interactive path: all clack ===
  clack.intro('viberails');

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

  // 5. Show scan results + rules as a note box
  const resultsText = formatScanResultsText(scanResult, config);
  clack.note(resultsText, 'Scan results');

  // 6. Accept or Customize
  const decision = await promptInitDecision();

  if (decision === 'customize') {
    clack.note(
      'Rules control what viberails checks for.\nYou can change these later in viberails.config.json.',
      'Rules',
    );

    const overrides = await promptRuleCustomization({
      maxFileLines: config.rules.maxFileLines,
      requireTests: config.rules.requireTests,
      enforceNaming: config.rules.enforceNaming,
      enforcement: config.enforcement,
      fileNamingValue: getConventionStr(config.conventions.fileNaming),
    });

    config.rules.maxFileLines = overrides.maxFileLines;
    config.rules.requireTests = overrides.requireTests;
    config.rules.enforceNaming = overrides.enforceNaming;
    config.enforcement = overrides.enforcement;

    if (config.workspace?.packages && config.workspace.packages.length > 0) {
      clack.note(
        'These rules apply globally. To customize per package,\n' +
          'edit the "packages" section in viberails.config.json.',
        'Per-package overrides',
      );
    }
  }

  // 7. Boundary inference (monorepo only)
  if (config.workspace?.packages && config.workspace.packages.length > 0) {
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
      const packages = resolveWorkspacePackages(projectRoot, config.workspace);
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
      } else {
        bs.stop('No boundary rules inferred');
      }
    }
  }

  // 8. Integration selection
  const hookManager = detectHookManager(projectRoot);
  const integrations = await promptIntegrations(hookManager);

  // 9. Per-package convention differences note
  if (hasConventionOverrides(config)) {
    clack.note(
      'Some packages use different conventions. Per-package\n' +
        'overrides have been saved in viberails.config.json —\n' +
        'review and adjust as needed.',
      'Per-package conventions',
    );
  }

  // 10. Write config
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

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
    const hookMgr = detectHookManager(projectRoot);
    if (hookMgr) {
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

  clack.outro('Done! Next: review viberails.config.json, then run viberails check');
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
