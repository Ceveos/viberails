import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadConfig, mergeConfig } from '@viberails/config';
import { scan } from '@viberails/scanner';
import type { CodebaseStatistics } from '@viberails/types';
import chalk from 'chalk';
import { diffConfigs, formatStatsDelta } from '../utils/diff-configs.js';
import { findProjectRoot } from '../utils/find-project-root.js';
import { writeGeneratedFiles } from '../utils/write-generated-files.js';

const CONFIG_FILE = 'viberails.config.json';
const SCAN_RESULT_FILE = '.viberails/scan-result.json';

/**
 * Try to load previous scan statistics from scan-result.json.
 */
function loadPreviousStats(projectRoot: string): CodebaseStatistics | undefined {
  const scanResultPath = path.join(projectRoot, SCAN_RESULT_FILE);
  try {
    const raw = fs.readFileSync(scanResultPath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed?.statistics?.totalFiles !== undefined) {
      return parsed.statistics as CodebaseStatistics;
    }
  } catch {
    // File missing or malformed — skip stats delta
  }
  return undefined;
}

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

  // 2. Load existing config and previous stats
  const configPath = path.join(projectRoot, CONFIG_FILE);
  const existing = await loadConfig(configPath);
  const previousStats = loadPreviousStats(projectRoot);

  // 3. Re-scan
  console.log(chalk.dim('Scanning project...'));
  const scanResult = await scan(projectRoot);

  // 4. Merge config and detect changes
  const merged = mergeConfig(existing, scanResult);
  const existingJson = JSON.stringify(existing, null, 2);
  const mergedJson = JSON.stringify(merged, null, 2);
  const configChanged = existingJson !== mergedJson;

  // 5. Report specific changes
  const changes = configChanged ? diffConfigs(existing, merged) : [];
  const statsDelta = previousStats
    ? formatStatsDelta(previousStats, scanResult.statistics)
    : undefined;

  if (changes.length > 0 || statsDelta) {
    console.log(`\n${chalk.bold('Changes:')}`);
    for (const change of changes) {
      const icon = change.type === 'removed' ? chalk.red('-') : chalk.green('+');
      console.log(`  ${icon} ${change.description}`);
    }
    if (statsDelta) {
      console.log(`  ${chalk.dim(statsDelta)}`);
    }
  }

  // 6. Write config
  fs.writeFileSync(configPath, `${mergedJson}\n`);

  // 7. Regenerate context and scan-result.json
  writeGeneratedFiles(projectRoot, merged, scanResult);

  // 8. Summary
  console.log(`\n${chalk.bold('Synced:')}`);
  if (configChanged) {
    console.log(`  ${chalk.yellow('!')} ${CONFIG_FILE} — updated (review changes)`);
  } else {
    console.log(`  ${chalk.green('✓')} ${CONFIG_FILE} — unchanged`);
  }
  console.log(`  ${chalk.green('✓')} .viberails/context.md — regenerated`);
  console.log(`  ${chalk.green('✓')} .viberails/scan-result.json — updated`);
}
