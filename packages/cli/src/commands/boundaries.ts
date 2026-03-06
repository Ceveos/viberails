import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadConfig } from '@viberails/config';
import type { ViberailsConfig } from '@viberails/types';
import chalk from 'chalk';
import { findProjectRoot } from '../utils/find-project-root.js';
import { confirm } from '../utils/prompt.js';
import { resolveWorkspacePackages } from '../utils/resolve-workspace-packages.js';

const CONFIG_FILE = 'viberails.config.json';

export interface BoundariesOptions {
  infer?: boolean;
  graph?: boolean;
}

/**
 * Display, infer, or inspect import boundary rules.
 *
 * @param options - CLI options
 * @param cwd - Working directory override (for testing)
 */
export async function boundariesCommand(options: BoundariesOptions, cwd?: string): Promise<void> {
  const startDir = cwd ?? process.cwd();
  const projectRoot = findProjectRoot(startDir);
  if (!projectRoot) {
    throw new Error('No package.json found. Are you in a JS/TS project?');
  }

  const configPath = path.join(projectRoot, CONFIG_FILE);
  if (!fs.existsSync(configPath)) {
    throw new Error('No viberails.config.json found. Run `viberails init` first.');
  }

  const config = await loadConfig(configPath);

  if (options.graph) {
    await showGraph(projectRoot, config);
    return;
  }

  if (options.infer) {
    await inferAndDisplay(projectRoot, config, configPath);
    return;
  }

  displayRules(config);
}

/** Display configured boundary rules. */
function displayRules(config: ViberailsConfig): void {
  if (!config.boundaries || config.boundaries.length === 0) {
    console.log(chalk.yellow('No boundary rules configured.'));
    console.log(`Run ${chalk.cyan('viberails boundaries --infer')} to generate rules.`);
    return;
  }

  const allowRules = config.boundaries.filter((r) => r.allow);
  const denyRules = config.boundaries.filter((r) => !r.allow);

  console.log(`\n${chalk.bold(`Boundary rules (${config.boundaries.length} rules):`)}\n`);

  for (const r of allowRules) {
    console.log(`  ${chalk.green('✓')} ${r.from} → ${r.to}`);
  }

  for (const r of denyRules) {
    const reason = r.reason ? chalk.dim(` (${r.reason})`) : '';
    console.log(`  ${chalk.red('✗')} ${r.from} → ${r.to}${reason}`);
  }

  console.log(
    `\nEnforcement: ${config.rules.enforceBoundaries ? chalk.green('on') : chalk.yellow('off')}`,
  );
}

/** Infer boundary rules from import patterns and optionally save. */
async function inferAndDisplay(
  projectRoot: string,
  config: ViberailsConfig,
  configPath: string,
): Promise<void> {
  console.log(chalk.dim('Analyzing imports...'));
  const { buildImportGraph, inferBoundaries } = await import('@viberails/graph');

  const packages = config.workspace
    ? resolveWorkspacePackages(projectRoot, config.workspace)
    : undefined;

  const graph = await buildImportGraph(projectRoot, {
    packages,
    ignore: config.ignore,
  });

  console.log(chalk.dim(`${graph.nodes.length} files, ${graph.edges.length} edges`));

  const inferred = inferBoundaries(graph);

  if (inferred.length === 0) {
    console.log(chalk.yellow('No boundary rules could be inferred.'));
    return;
  }

  const allow = inferred.filter((r) => r.allow);
  const deny = inferred.filter((r) => !r.allow);

  console.log(`\n${chalk.bold('Inferred boundary rules:')}\n`);

  for (const r of allow) {
    console.log(`  ${chalk.green('✓')} ${r.from} → ${r.to}`);
  }

  for (const r of deny) {
    const reason = r.reason ? chalk.dim(` (${r.reason})`) : '';
    console.log(`  ${chalk.red('✗')} ${r.from} → ${r.to}${reason}`);
  }

  console.log(`\n  ${allow.length} allowed, ${deny.length} denied`);

  const shouldSave = await confirm('\nSave to viberails.config.json?');
  if (shouldSave) {
    config.boundaries = inferred;
    config.rules.enforceBoundaries = true;
    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
    console.log(`${chalk.green('✓')} Saved ${inferred.length} rules`);
  }
}

/** Display import graph summary. */
async function showGraph(projectRoot: string, config: ViberailsConfig): Promise<void> {
  console.log(chalk.dim('Building import graph...'));
  const { buildImportGraph } = await import('@viberails/graph');

  const packages = config.workspace
    ? resolveWorkspacePackages(projectRoot, config.workspace)
    : undefined;

  const graph = await buildImportGraph(projectRoot, {
    packages,
    ignore: config.ignore,
  });

  console.log(`\n${chalk.bold('Import dependency graph:')}\n`);
  console.log(`  ${graph.nodes.length} files, ${graph.edges.length} imports\n`);

  if (graph.packages.length > 0) {
    for (const pkg of graph.packages) {
      const deps =
        pkg.internalDeps.length > 0
          ? `\n${pkg.internalDeps.map((d) => `    → ${d}`).join('\n')}`
          : chalk.dim(' (no internal deps)');
      console.log(`  ${pkg.name}${deps}`);
    }
  }

  if (graph.cycles.length > 0) {
    console.log(`\n${chalk.yellow('Cycles detected:')}`);
    for (const cycle of graph.cycles) {
      const paths = cycle.map((f) => path.relative(projectRoot, f));
      console.log(`  ${paths.join(' → ')}`);
    }
  }
}
