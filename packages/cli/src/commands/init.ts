import * as fs from 'node:fs';
import * as path from 'node:path';
import { generateConfig } from '@viberails/config';
import { scan } from '@viberails/scanner';
import type { ConfigConventions, ConventionValue } from '@viberails/types';
import chalk from 'chalk';
import { displayScanResults } from '../display.js';
import { findProjectRoot } from '../utils/find-project-root.js';
import { confirm } from '../utils/prompt.js';
import { resolveWorkspacePackages } from '../utils/resolve-workspace-packages.js';
import { writeGeneratedFiles } from '../utils/write-generated-files.js';

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

  // 4. Display results
  displayScanResults(scanResult);

  // 5. Sparse project notice
  if (scanResult.statistics.totalFiles === 0) {
    console.log(
      chalk.yellow('!') +
        ' No source files detected. viberails will generate context with minimal content.\n' +
        '  Run ' +
        chalk.cyan('viberails sync') +
        ' after adding source files.\n',
    );
  }

  // 6. Interactive confirmation
  if (!options.yes) {
    const accepted = await confirm('Does this look right?');
    if (!accepted) {
      console.log('Aborted.');
      return;
    }
  }

  // 7. Generate config
  const config = generateConfig(scanResult);
  if (options.yes) {
    config.conventions = filterHighConfidence(config.conventions);
  }

  // 7b. Infer boundary rules for workspace projects
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

  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

  // 8. Generate context and scan-result.json
  writeGeneratedFiles(projectRoot, config, scanResult);

  // 9. Update .gitignore
  updateGitignore(projectRoot);

  // 10. Set up pre-commit hook
  setupPreCommitHook(projectRoot);

  // 11. Print summary
  console.log(`\n${chalk.bold('Created:')}`);
  console.log(`  ${chalk.green('✓')} ${CONFIG_FILE}`);
  console.log(`  ${chalk.green('✓')} .viberails/context.md`);
  console.log(`  ${chalk.green('✓')} .viberails/scan-result.json`);
  console.log(`\n${chalk.bold('Next steps:')}`);
  console.log(`  1. Review ${chalk.cyan('viberails.config.json')} and adjust rules`);
  console.log(
    `  2. Commit ${chalk.cyan('viberails.config.json')} and ${chalk.cyan('.viberails/context.md')}`,
  );
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
    fs.writeFileSync(gitignorePath, `${content.trimEnd()}\n${block}`);
  }
}

/**
 * Set up a pre-commit hook that runs viberails check on staged files.
 * Detects Lefthook, Husky, or falls back to a raw git hook.
 */
function setupPreCommitHook(projectRoot: string): void {
  // Check for Lefthook
  const lefthookPath = path.join(projectRoot, 'lefthook.yml');
  if (fs.existsSync(lefthookPath)) {
    addLefthookPreCommit(lefthookPath);
    console.log(`  ${chalk.green('✓')} lefthook.yml — added viberails pre-commit`);
    return;
  }

  // Check for Husky
  const huskyDir = path.join(projectRoot, '.husky');
  if (fs.existsSync(huskyDir)) {
    writeHuskyPreCommit(huskyDir);
    console.log(`  ${chalk.green('✓')} .husky/pre-commit — added viberails check`);
    return;
  }

  // Fall back to raw git hook
  const gitDir = path.join(projectRoot, '.git');
  if (fs.existsSync(gitDir)) {
    const hooksDir = path.join(gitDir, 'hooks');
    if (!fs.existsSync(hooksDir)) {
      fs.mkdirSync(hooksDir, { recursive: true });
    }
    writeGitHookPreCommit(hooksDir);
    console.log(`  ${chalk.green('✓')} .git/hooks/pre-commit`);
  }
}

function writeGitHookPreCommit(hooksDir: string): void {
  const hookPath = path.join(hooksDir, 'pre-commit');
  if (fs.existsSync(hookPath)) {
    const existing = fs.readFileSync(hookPath, 'utf-8');
    if (existing.includes('viberails')) return;
    fs.writeFileSync(
      hookPath,
      `${existing.trimEnd()}\n\n# viberails check\nnpx viberails check --staged\n`,
    );
    return;
  }
  const script = [
    '#!/bin/sh',
    '# Generated by viberails — https://viberails.sh',
    '',
    'npx viberails check --staged',
    '',
  ].join('\n');
  fs.writeFileSync(hookPath, script, { mode: 0o755 });
}

function addLefthookPreCommit(lefthookPath: string): void {
  const content = fs.readFileSync(lefthookPath, 'utf-8');
  if (content.includes('viberails')) return;
  const addition = ['', '  viberails:', '    run: npx viberails check --staged'].join('\n');
  fs.writeFileSync(lefthookPath, `${content.trimEnd()}\n${addition}\n`);
}

function writeHuskyPreCommit(huskyDir: string): void {
  const hookPath = path.join(huskyDir, 'pre-commit');
  if (fs.existsSync(hookPath)) {
    const existing = fs.readFileSync(hookPath, 'utf-8');
    if (!existing.includes('viberails')) {
      fs.writeFileSync(hookPath, `${existing.trimEnd()}\nnpx viberails check --staged\n`);
    }
    return;
  }
  fs.writeFileSync(hookPath, '#!/bin/sh\nnpx viberails check --staged\n', { mode: 0o755 });
}
