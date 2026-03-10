import * as fs from 'node:fs';
import * as path from 'node:path';
import * as clack from '@clack/prompts';
import { compactConfig, loadConfig, mergeConfig } from '@viberails/config';
import { scan } from '@viberails/scanner';
import type { CodebaseStatistics } from '@viberails/types';
import chalk from 'chalk';
import { formatRulesText } from '../display-text.js';
import { applyRuleOverrides } from '../utils/apply-rule-overrides.js';
import { diffConfigs, formatStatsDelta } from '../utils/diff-configs.js';
import { findProjectRoot } from '../utils/find-project-root.js';
import { assertNotCancelled, promptRuleMenu } from '../utils/prompt.js';
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
 * @param options - Command options (interactive mode)
 * @param cwd - Working directory override (for testing)
 */
export async function syncCommand(
  options?: { interactive?: boolean },
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

  // 2. Load existing config and previous stats
  const configPath = path.join(projectRoot, CONFIG_FILE);
  const existing = await loadConfig(configPath);
  const previousStats = loadPreviousStats(projectRoot);

  // 3. Re-scan
  const s = clack.spinner();
  s.start('Scanning project...');
  const scanResult = await scan(projectRoot);
  s.stop('Scan complete');

  // 4. Merge config and detect changes
  const merged = mergeConfig(existing, scanResult);
  const compacted = compactConfig(merged);
  const compactedJson = JSON.stringify(compacted, null, 2);

  // Compare against raw disk JSON (ignoring lastSync timestamp)
  const rawDisk = fs.readFileSync(configPath, 'utf-8').trim();
  const diskWithoutSync = rawDisk.replace(/"lastSync":\s*"[^"]*"/, '"lastSync": ""');
  const mergedWithoutSync = compactedJson.replace(/"lastSync":\s*"[^"]*"/, '"lastSync": ""');
  const configChanged = diskWithoutSync !== mergedWithoutSync;

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

  // 5b. Interactive review (if --interactive)
  if (options?.interactive) {
    clack.intro('viberails sync (interactive)');
    clack.note(formatRulesText(merged).join('\n'), 'Rules after sync');

    const decision = await clack.select({
      message: 'How would you like to proceed?',
      options: [
        { value: 'accept' as const, label: 'Accept changes' },
        { value: 'customize' as const, label: 'Customize rules' },
        { value: 'cancel' as const, label: 'Cancel (no changes written)' },
      ],
    });
    assertNotCancelled(decision);

    if (decision === 'cancel') {
      clack.outro('Sync cancelled. No files were written.');
      return;
    }

    if (decision === 'customize') {
      const rootPkg = merged.packages.find((p) => p.path === '.') ?? merged.packages[0];
      const overrides = await promptRuleMenu({
        maxFileLines: merged.rules.maxFileLines,
        maxTestFileLines: merged.rules.maxTestFileLines,
        testCoverage: merged.rules.testCoverage,
        enforceMissingTests: merged.rules.enforceMissingTests,
        enforceNaming: merged.rules.enforceNaming,
        fileNamingValue: rootPkg.conventions?.fileNaming,
        componentNaming: rootPkg.conventions?.componentNaming,
        hookNaming: rootPkg.conventions?.hookNaming,
        importAlias: rootPkg.conventions?.importAlias,
        coverageSummaryPath: rootPkg.coverage?.summaryPath ?? 'coverage/coverage-summary.json',
        coverageCommand: merged.defaults?.coverage?.command,
        packageOverrides: merged.packages,
      });
      applyRuleOverrides(merged, overrides);

      // Recompact after overrides
      const recompacted = compactConfig(merged);
      fs.writeFileSync(configPath, `${JSON.stringify(recompacted, null, 2)}\n`);
      writeGeneratedFiles(projectRoot, merged, scanResult);

      clack.log.success('Updated config with your customizations.');
      clack.outro('Done! Run viberails check to verify.');
      return;
    }
  }

  // 6. Write config (compacted)
  fs.writeFileSync(configPath, `${compactedJson}\n`);

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
