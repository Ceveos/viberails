import * as fs from 'node:fs';
import * as path from 'node:path';
import * as clack from '@clack/prompts';
import { compactConfig, generateConfig } from '@viberails/config';
import { scan } from '@viberails/scanner';
import chalk from 'chalk';
import { checkCoveragePrereqs } from '../utils/check-prerequisites.js';
import { executeDeferredInstalls } from '../utils/deferred-install.js';
import { findProjectRoot } from '../utils/find-project-root.js';
import { confirm, confirmDangerous, promptExistingConfigAction } from '../utils/prompt.js';
import { promptIntegrationsDeferred } from '../utils/prompt-integrations.js';
import { promptMainMenu } from '../utils/prompt-main-menu.js';
import { promptPrereqs } from '../utils/prompt-prereqs.js';
import { updateGitignore } from '../utils/update-gitignore.js';
import { writeGeneratedFiles } from '../utils/write-generated-files.js';
import { configCommand } from './config.js';
import { detectHookManager } from './init-hooks.js';
import { setupSelectedIntegrations } from './init-hooks-extra.js';
import { initNonInteractive } from './init-non-interactive.js';

const CONFIG_FILE = 'viberails.config.json';

/** Run the viberails init flow. */
export async function initCommand(
  options: { yes?: boolean; force?: boolean },
  cwd?: string,
): Promise<void> {
  const projectRoot = findProjectRoot(cwd ?? process.cwd());
  if (!projectRoot) {
    throw new Error(
      'No package.json found. Make sure you are inside a JS/TS project, then run:\n  npx viberails',
    );
  }

  const configPath = path.join(projectRoot, CONFIG_FILE);
  if (fs.existsSync(configPath) && !options.force) {
    if (!options.yes) {
      return initInteractive(projectRoot, configPath, options);
    }
    console.log(
      `${chalk.yellow('!')} viberails is already initialized.\n` +
        `  Run ${chalk.cyan('viberails')} to review or edit the existing setup, ${chalk.cyan('viberails sync')} to update generated files, or ${chalk.cyan('viberails init --force')} to replace it.`,
    );
    return;
  }
  if (options.yes) return initNonInteractive(projectRoot, configPath);
  await initInteractive(projectRoot, configPath, options);
}

async function initInteractive(
  projectRoot: string,
  configPath: string,
  options: { force?: boolean },
): Promise<void> {
  clack.intro('viberails');

  if (fs.existsSync(configPath) && !options.force) {
    const action = await promptExistingConfigAction(path.basename(configPath));
    if (action === 'cancel') {
      clack.outro('Aborted. No files were written.');
      return;
    }
    if (action === 'edit') {
      await configCommand({ suppressIntro: true }, projectRoot);
      return;
    }
    options.force = true;
  }

  if (fs.existsSync(configPath) && options.force) {
    const replace = await confirmDangerous(
      `${path.basename(configPath)} already exists and will be replaced. Continue?`,
    );
    if (!replace) {
      clack.outro('Aborted. No files were written.');
      return;
    }
  }

  // Scan
  const s = clack.spinner();
  s.start('Scanning project...');
  const scanResult = await scan(projectRoot);
  const config = generateConfig(scanResult);
  s.stop('Scan complete');

  if (scanResult.statistics.totalFiles === 0) {
    clack.log.warn(
      'No source files detected. Try running from the project root,\n' +
        'or check that source files exist. Run viberails sync after adding files.',
    );
  }

  // Prerequisites — prompt to install missing tools before the menu
  const rootPkgStack = (config.packages.find((p) => p.path === '.') ?? config.packages[0])?.stack;
  const packageManager = rootPkgStack?.packageManager?.split('@')[0] ?? 'npm';
  const isWorkspace = config.packages.length > 1;

  const prereqs = await promptPrereqs(
    projectRoot,
    scanResult,
    detectHookManager(projectRoot),
    packageManager,
    isWorkspace,
  );

  if (prereqs.skipCoverage) config.rules.testCoverage = 0;

  // Coverage prereqs (for provider libs like @vitest/coverage-v8)
  const coveragePrereqs = prereqs.hasTestRunner
    ? checkCoveragePrereqs(projectRoot, scanResult)
    : [];

  // Main menu loop
  const state = await promptMainMenu(config, scanResult, {
    hasTestRunner: prereqs.hasTestRunner,
    hookManager: prereqs.hookManager,
    coveragePrereqs,
    projectRoot,
    tools: {
      isTypeScript: rootPkgStack?.language?.split('@')[0] === 'typescript',
      linter: rootPkgStack?.linter?.split('@')[0],
      packageManager,
      isWorkspace,
    },
  });

  // Final confirmation
  const shouldWrite = await confirm('Apply this setup?');
  if (!shouldWrite) {
    clack.outro('Aborted. No files were written.');
    return;
  }

  // Integrations — prompt after config is finalized
  const integrations = await promptIntegrationsDeferred(prereqs.hookManager, {
    isTypeScript: rootPkgStack?.language?.split('@')[0] === 'typescript',
    typecheckLabel: prereqs.typecheckLabel,
    linter: rootPkgStack?.linter?.split('@')[0],
    packageManager,
    isWorkspace,
  });

  // Execute deferred installs (coverage provider)
  if (state.deferredInstalls.length > 0) {
    await executeDeferredInstalls(projectRoot, state.deferredInstalls);
  }

  // Write config files
  const ws = clack.spinner();
  ws.start('Writing configuration...');
  const compacted = compactConfig(config);
  fs.writeFileSync(configPath, `${JSON.stringify(compacted, null, 2)}\n`);
  writeGeneratedFiles(projectRoot, config, scanResult);
  updateGitignore(projectRoot);
  ws.stop('Configuration written');

  const ok = chalk.green('\u2713');
  clack.log.step(`${ok} ${path.basename(configPath)}`);
  clack.log.step(`${ok} .viberails/context.md`);
  clack.log.step(`${ok} .viberails/scan-result.json`);

  // Setup integrations
  setupSelectedIntegrations(projectRoot, integrations.choice, {
    linter: rootPkgStack?.linter?.split('@')[0],
    packageManager,
    lefthookExpected: prereqs.hookManager === 'lefthook',
  });

  clack.outro(
    `Done! Next: review viberails.config.json, then run viberails check\n` +
      `  ${chalk.dim('Tip: use')} ${chalk.cyan('viberails check --enforce')} ${chalk.dim('in CI to block PRs on violations.')}`,
  );
}
