import * as fs from 'node:fs';
import * as path from 'node:path';
import * as clack from '@clack/prompts';
import { compactConfig, loadConfig, mergeConfig } from '@viberails/config';
import { scan } from '@viberails/scanner';
import chalk from 'chalk';
import { formatRulesText } from '../display-text.js';
import { applyRuleOverrides } from '../utils/apply-rule-overrides.js';
import { diffConfigs } from '../utils/diff-configs.js';
import { findProjectRoot } from '../utils/find-project-root.js';
import { confirm, promptRuleMenu } from '../utils/prompt.js';
import { resolveWorkspacePackages } from '../utils/resolve-workspace-packages.js';
import { writeGeneratedFiles } from '../utils/write-generated-files.js';

const CONFIG_FILE = 'viberails.config.json';

/**
 * Run the viberails config command: interactively edit existing config rules.
 *
 * @param options - Command options
 * @param cwd - Working directory override (for testing)
 */
export async function configCommand(
  options: { rescan?: boolean; suppressIntro?: boolean },
  cwd?: string,
): Promise<void> {
  const projectRoot = findProjectRoot(cwd ?? process.cwd());
  if (!projectRoot) {
    throw new Error('No package.json found. Make sure you are inside a JS/TS project.');
  }

  const configPath = path.join(projectRoot, CONFIG_FILE);
  if (!fs.existsSync(configPath)) {
    console.log(`${chalk.yellow('!')} No config found. Run ${chalk.cyan('viberails')} first.`);
    return;
  }

  if (!options.suppressIntro) {
    clack.intro('viberails config');
  }

  const config = await loadConfig(configPath);
  let scanResult = options.rescan ? await rescanAndMerge(projectRoot, config) : undefined;

  // Show current rules
  clack.note(formatRulesText(config).join('\n'), 'Current rules');

  // Open rule menu with current values
  const rootPkg = config.packages.find((p) => p.path === '.') ?? config.packages[0];
  const overrides = await promptRuleMenu({
    maxFileLines: config.rules.maxFileLines,
    testCoverage: config.rules.testCoverage,
    enforceMissingTests: config.rules.enforceMissingTests,
    enforceNaming: config.rules.enforceNaming,
    fileNamingValue: rootPkg.conventions?.fileNaming,
    coverageSummaryPath: rootPkg.coverage?.summaryPath ?? 'coverage/coverage-summary.json',
    coverageCommand: config.defaults?.coverage?.command,
    packageOverrides: config.packages,
  });

  applyRuleOverrides(config, overrides);

  // Re-infer boundaries if rescan on a monorepo
  if (options.rescan && config.packages.length > 1) {
    const shouldInfer = await confirm('Re-infer boundary rules from import patterns?');
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
      } else {
        bs.stop('No boundary rules inferred');
      }
    }
  }

  // Confirm and write
  const shouldWrite = await confirm('Save updated configuration?');
  if (!shouldWrite) {
    clack.outro('No changes written.');
    return;
  }

  const compacted = compactConfig(config);
  fs.writeFileSync(configPath, `${JSON.stringify(compacted, null, 2)}\n`);

  // Regenerate context files (need scan result)
  if (!scanResult) {
    const s = clack.spinner();
    s.start('Scanning for context generation...');
    scanResult = await scan(projectRoot);
    s.stop('Scan complete');
  }

  writeGeneratedFiles(projectRoot, config, scanResult);

  clack.log.success(
    `Updated:\n  ${CONFIG_FILE}\n  .viberails/context.md\n  .viberails/scan-result.json`,
  );
  clack.outro('Done! Run viberails check to verify.');
}

async function rescanAndMerge(
  projectRoot: string,
  config: import('@viberails/types').ViberailsConfig,
): Promise<import('@viberails/types').ScanResult> {
  const s = clack.spinner();
  s.start('Re-scanning project...');
  const scanResult = await scan(projectRoot);
  const merged = mergeConfig(config, scanResult);
  s.stop('Scan complete');

  // Show diff if anything changed
  const changes = diffConfigs(config, merged);
  if (changes.length > 0) {
    const changeLines = changes
      .map((c) => {
        const icon = c.type === 'removed' ? '-' : '+';
        return `${icon} ${c.description}`;
      })
      .join('\n');
    clack.note(changeLines, 'Changes detected');
  } else {
    clack.log.info('No new changes detected from scan.');
  }

  // Apply merged values back
  Object.assign(config, merged);

  return scanResult;
}
