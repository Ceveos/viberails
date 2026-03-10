import * as fs from 'node:fs';
import * as path from 'node:path';
import * as clack from '@clack/prompts';
import { compactConfig, generateConfig } from '@viberails/config';
import { scan } from '@viberails/scanner';
import chalk from 'chalk';
import { displayRulesPreview, displayScanResults } from '../display.js';
import { checkCoveragePrereqs, displayMissingPrereqs } from '../utils/check-prerequisites.js';
import { filterHighConfidence } from '../utils/filter-confidence.js';
import { resolveWorkspacePackages } from '../utils/resolve-workspace-packages.js';
import { updateGitignore } from '../utils/update-gitignore.js';
import { writeGeneratedFiles } from '../utils/write-generated-files.js';
import {
  detectHookManager,
  setupClaudeCodeHook,
  setupClaudeMdReference,
  setupGithubAction,
  setupPreCommitHook,
} from './init-hooks.js';
import { setupLintHook, setupTypecheckHook } from './init-hooks-extra.js';

function getExemptedPackages(config: import('@viberails/types').ViberailsConfig): string[] {
  return config.packages
    .filter((pkg) => pkg.rules?.testCoverage === 0 && pkg.path !== '.')
    .map((pkg) => pkg.path);
}

export async function initNonInteractive(projectRoot: string, configPath: string): Promise<void> {
  const s = clack.spinner();
  s.start('Scanning project...');
  const scanResult = await scan(projectRoot);
  const config = generateConfig(scanResult);
  s.stop('Scan complete');

  for (const pkg of config.packages) {
    const pkgMeta = config._meta?.packages?.[pkg.path]?.conventions;
    pkg.conventions = filterHighConfidence(pkg.conventions ?? {}, pkgMeta);
  }

  displayMissingPrereqs(checkCoveragePrereqs(projectRoot, scanResult));

  displayScanResults(scanResult);
  displayRulesPreview(config);

  const exempted = getExemptedPackages(config);
  if (exempted.length > 0) {
    console.log(
      `  ${chalk.dim('Auto-exempted from coverage:')} ${exempted.join(', ')} ${chalk.dim('(types-only)')}`,
    );
  }

  if (config.packages.length > 1) {
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

  const compacted = compactConfig(config);
  fs.writeFileSync(configPath, `${JSON.stringify(compacted, null, 2)}\n`);
  writeGeneratedFiles(projectRoot, config, scanResult);
  updateGitignore(projectRoot);

  setupClaudeCodeHook(projectRoot);
  setupClaudeMdReference(projectRoot);
  const rootPkg = config.packages[0];
  const rootPkgPm = rootPkg?.stack?.packageManager?.split('@')[0] ?? 'npm';
  const linter = rootPkg?.stack?.linter?.split('@')[0];
  const isTypeScript = rootPkg?.stack?.language?.split('@')[0] === 'typescript';
  const actionTarget = setupGithubAction(projectRoot, rootPkgPm, {
    linter,
    typecheck: isTypeScript,
  });

  // Skip bare .git/hooks in --yes mode — they're local-only and won't be shared.
  const hookManager = detectHookManager(projectRoot);
  const hasHookManager = hookManager === 'Lefthook' || hookManager === 'Husky';
  const preCommitTarget = hasHookManager ? setupPreCommitHook(projectRoot) : undefined;

  const ok = chalk.green('\u2713');
  const created = [
    `${ok} ${path.basename(configPath)}`,
    `${ok} .viberails/context.md`,
    `${ok} .viberails/scan-result.json`,
    `${ok} .claude/settings.json \u2014 added viberails hook`,
    `${ok} CLAUDE.md \u2014 added @.viberails/context.md reference`,
    preCommitTarget
      ? `${ok} ${preCommitTarget}`
      : `${chalk.yellow('!')} pre-commit hook skipped (install lefthook or husky)`,
    actionTarget ? `${ok} ${actionTarget} \u2014 blocks PRs on violations` : '',
  ].filter(Boolean);

  if (hasHookManager && isTypeScript) setupTypecheckHook(projectRoot, rootPkgPm);
  if (hasHookManager && linter) setupLintHook(projectRoot, linter);
  console.log(`\nCreated:\n${created.map((f) => `  ${f}`).join('\n')}`);
}
