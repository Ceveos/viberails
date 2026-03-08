import * as fs from 'node:fs';
import * as path from 'node:path';
import { generateConfig } from '@viberails/config';
import { scan } from '@viberails/scanner';
import type { ConfigConventions, ConventionValue } from '@viberails/types';
import chalk from 'chalk';
import { displayRulesPreview, displayScanResults } from '../display.js';
import { findProjectRoot } from '../utils/find-project-root.js';
import { confirm, selectIntegrations } from '../utils/prompt.js';
import { resolveWorkspacePackages } from '../utils/resolve-workspace-packages.js';
import { writeGeneratedFiles } from '../utils/write-generated-files.js';
import { detectHookManager, setupClaudeCodeHook, setupPreCommitHook } from './init-hooks.js';

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
 * Run the viberails init flow.
 *
 * @param options - CLI options
 * @param cwd - Working directory override (for testing)
 */
export async function initCommand(options: { yes?: boolean }, cwd?: string): Promise<void> {
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

  // 2. Check for existing config
  const configPath = path.join(projectRoot, CONFIG_FILE);
  if (fs.existsSync(configPath)) {
    console.log(
      chalk.yellow('!') +
        ' viberails is already initialized in this project.\n' +
        '  Run ' +
        chalk.cyan('viberails sync') +
        ' to update the generated files.',
    );
    return;
  }

  // 3. Run scanner
  console.log(chalk.dim('Scanning project...'));
  const scanResult = await scan(projectRoot);

  // 4. Generate config early so we can show rules preview
  const config = generateConfig(scanResult);
  if (options.yes) {
    config.conventions = filterHighConfidence(config.conventions);
  }

  // 5. Display scan results
  displayScanResults(scanResult);

  // 6. Sparse project notice
  if (scanResult.statistics.totalFiles === 0) {
    console.log(
      chalk.yellow('!') +
        ' No source files detected. viberails will generate context with minimal content.\n' +
        '  Run ' +
        chalk.cyan('viberails sync') +
        ' after adding source files.\n',
    );
  }

  // 7. Show rules preview
  displayRulesPreview(config);

  // 8. Interactive confirmation
  if (!options.yes) {
    const accepted = await confirm('Proceed with these settings?');
    if (!accepted) {
      console.log('Aborted.');
      return;
    }
  }

  // 9. Infer boundary rules for workspace projects
  if (config.workspace && config.workspace.packages.length > 0) {
    let shouldInfer = options.yes;
    if (!options.yes) {
      shouldInfer = await confirm('Infer boundary rules from import patterns?');
    }

    if (shouldInfer) {
      console.log(chalk.dim('Building import graph...'));
      const { buildImportGraph, inferBoundaries } = await import('@viberails/graph');
      const packages = resolveWorkspacePackages(projectRoot, config.workspace);
      const graph = await buildImportGraph(projectRoot, { packages, ignore: config.ignore });
      const inferred = inferBoundaries(graph);
      if (inferred.length > 0) {
        config.boundaries = inferred;
        config.rules.enforceBoundaries = true;
        console.log(`  ${chalk.green('✓')} Inferred ${inferred.length} boundary rules`);
      }
    }
  }

  // 10. Select integrations
  const hookManager = detectHookManager(projectRoot);
  let integrations = { preCommitHook: true, claudeCodeHook: true };
  if (!options.yes) {
    console.log('');
    integrations = await selectIntegrations(hookManager);
  }

  // 11. Write config
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

  // 12. Generate context and scan-result.json
  writeGeneratedFiles(projectRoot, config, scanResult);

  // 13. Update .gitignore
  updateGitignore(projectRoot);

  // 14. Set up hooks based on selection
  console.log(`\n${chalk.bold('Created:')}`);
  console.log(`  ${chalk.green('✓')} ${CONFIG_FILE}`);
  console.log(`  ${chalk.green('✓')} .viberails/context.md`);
  console.log(`  ${chalk.green('✓')} .viberails/scan-result.json`);

  if (integrations.preCommitHook) {
    setupPreCommitHook(projectRoot);
  }
  if (integrations.claudeCodeHook) {
    setupClaudeCodeHook(projectRoot);
  }

  // 15. Print next steps
  const filesToCommit = [
    `${chalk.cyan('viberails.config.json')}`,
    chalk.cyan('.viberails/context.md'),
  ];
  if (integrations.claudeCodeHook) {
    filesToCommit.push(chalk.cyan('.claude/settings.json'));
  }

  console.log(`\n${chalk.bold('Next steps:')}`);
  console.log(`  1. Review ${chalk.cyan('viberails.config.json')} and adjust rules`);
  console.log(`  2. Commit ${filesToCommit.join(', ')}`);
  console.log(`  3. Run ${chalk.cyan('viberails check')} to verify your project passes`);
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
