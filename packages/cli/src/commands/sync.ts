import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadConfig, mergeConfig } from '@viberails/config';
import { scan } from '@viberails/scanner';
import chalk from 'chalk';
import { findProjectRoot } from '../utils/find-project-root.js';
import { writeGeneratedFiles } from '../utils/write-generated-files.js';

const CONFIG_FILE = 'viberails.config.json';

/**
 * Run the viberails sync flow: re-scan, merge config, regenerate context.
 *
 * @param cwd - Working directory override (for testing)
 */
export async function syncCommand(cwd?: string): Promise<void> {
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

  // 2. Load existing config
  const configPath = path.join(projectRoot, CONFIG_FILE);
  const existing = await loadConfig(configPath);

  // 3. Re-scan
  console.log(chalk.dim('Scanning project...'));
  const scanResult = await scan(projectRoot);

  // 4. Merge config and detect changes
  const merged = mergeConfig(existing, scanResult);
  const existingJson = JSON.stringify(existing, null, 2);
  const mergedJson = JSON.stringify(merged, null, 2);
  const configChanged = existingJson !== mergedJson;

  if (configChanged) {
    console.log(
      `  ${chalk.yellow('!')} Config updated — review ${chalk.cyan(CONFIG_FILE)} for changes`,
    );
  }

  fs.writeFileSync(configPath, `${mergedJson}\n`);

  // 5. Regenerate context and scan-result.json
  writeGeneratedFiles(projectRoot, merged, scanResult);

  console.log(`\n${chalk.bold('Synced:')}`);
  if (configChanged) {
    console.log(`  ${chalk.yellow('!')} ${CONFIG_FILE} — updated (review changes)`);
  } else {
    console.log(`  ${chalk.green('✓')} ${CONFIG_FILE} — unchanged`);
  }
  console.log(`  ${chalk.green('✓')} .viberails/context.md — regenerated`);
  console.log(`  ${chalk.green('✓')} .viberails/scan-result.json — updated`);
}
