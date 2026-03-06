import * as fs from 'node:fs';
import * as path from 'node:path';
import chalk from 'chalk';
import { generateConfig } from '@viberails/config';
import { generateContext, generateCursorrules } from '@viberails/context';
import { scan } from '@viberails/scanner';
import type { ConfigConventions, ConventionValue } from '@viberails/types';
import { displayScanResults } from '../display.js';
import { findProjectRoot } from '../utils/find-project-root.js';
import { confirm } from '../utils/prompt.js';

const CONFIG_FILE = 'viberails.config.json';
const CONTEXT_DIR = '.viberails';
const CONTEXT_FILE = 'context.md';
const IMPORT_DIRECTIVE = '@import .viberails/context.md';

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
export async function initCommand(
  options: { yes?: boolean },
  cwd?: string,
): Promise<void> {
  const startDir = cwd ?? process.cwd();

  // 1. Find project root
  const projectRoot = findProjectRoot(startDir);
  if (!projectRoot) {
    console.error(
      chalk.red('Error:') + ' No package.json found in this directory or any parent.\n\n' +
      'Make sure you are inside a JavaScript or TypeScript project, then run:\n' +
      chalk.cyan('  npx viberails'),
    );
    process.exit(1);
  }

  // 2. Check for existing config
  const configPath = path.join(projectRoot, CONFIG_FILE);
  if (fs.existsSync(configPath)) {
    console.log(
      chalk.yellow('!') + ' viberails is already initialized in this project.\n' +
      '  Run ' + chalk.cyan('viberails sync') + ' to update the generated files.',
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
      chalk.yellow('!') + ' No source files detected. viberails will generate context with minimal content.\n' +
      '  Run ' + chalk.cyan('viberails sync') + ' after adding source files.\n',
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
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

  // 8. Generate context
  const context = generateContext(config, scanResult);
  const contextDir = path.join(projectRoot, CONTEXT_DIR);
  if (!fs.existsSync(contextDir)) {
    fs.mkdirSync(contextDir, { recursive: true });
  }
  fs.writeFileSync(path.join(contextDir, CONTEXT_FILE), context);

  // 9. Scaffold CLAUDE.md
  const claudeMdPath = path.join(projectRoot, 'CLAUDE.md');
  if (fs.existsSync(claudeMdPath)) {
    const existing = fs.readFileSync(claudeMdPath, 'utf-8');
    if (!existing.includes(IMPORT_DIRECTIVE)) {
      fs.writeFileSync(claudeMdPath, existing.trimEnd() + '\n\n' + IMPORT_DIRECTIVE + '\n');
    }
  } else {
    fs.writeFileSync(
      claudeMdPath,
      `# ${config.name}\n\n${IMPORT_DIRECTIVE}\n`,
    );
  }

  // 10. Generate .cursorrules
  const cursorrullesLocalPath = path.join(projectRoot, '.cursorrules.local');
  const userCursorrules = fs.existsSync(cursorrullesLocalPath)
    ? fs.readFileSync(cursorrullesLocalPath, 'utf-8')
    : undefined;
  const cursorrules = generateCursorrules(context, userCursorrules);
  fs.writeFileSync(path.join(projectRoot, '.cursorrules'), cursorrules);

  // 11. Update .gitignore
  updateGitignore(projectRoot);

  // 12. Print summary
  console.log('\n' + chalk.bold('Created:'));
  console.log(`  ${chalk.green('✓')} ${CONFIG_FILE}`);
  console.log(`  ${chalk.green('✓')} ${CONTEXT_DIR}/${CONTEXT_FILE}`);
  console.log(`  ${chalk.green('✓')} .cursorrules`);
  console.log(`  ${chalk.green('✓')} CLAUDE.md`);
  console.log('\n' + chalk.bold('Next steps:'));
  console.log('  1. Review ' + chalk.cyan('viberails.config.json') + ' and adjust as needed');
  console.log('  2. Commit the generated files');
  console.log('  3. Run ' + chalk.cyan('viberails sync') + ' after making project changes');
}

/**
 * Append viberails entries to .gitignore if not already present.
 */
function updateGitignore(projectRoot: string): void {
  const gitignorePath = path.join(projectRoot, '.gitignore');
  let content = '';

  if (fs.existsSync(gitignorePath)) {
    content = fs.readFileSync(gitignorePath, 'utf-8');
  }

  const entriesToAdd: string[] = [];
  if (!content.includes('.viberails/')) {
    entriesToAdd.push('.viberails/');
  }
  if (!content.includes('.cursorrules')) {
    entriesToAdd.push('.cursorrules');
  }

  if (entriesToAdd.length > 0) {
    const block = '\n# viberails\n' + entriesToAdd.join('\n') + '\n';
    fs.writeFileSync(gitignorePath, content.trimEnd() + '\n' + block);
  }
}
