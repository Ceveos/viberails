import type { ScanResult, StackItem, ViberailsConfig } from '@viberails/types';
import { FRAMEWORK_NAMES, STYLING_NAMES } from '@viberails/types';
import chalk from 'chalk';
import { formatItem } from './display.js';
import type { IntegrationChoice } from './utils/prompt-integrations.js';

const INIT_OVERVIEW_NAMES: Record<string, string> = {
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  eslint: 'ESLint',
  prettier: 'Prettier',
  jest: 'Jest',
  vitest: 'Vitest',
  biome: 'Biome',
};

function formatDetectedOverview(scanResult: ScanResult): string {
  const { stack } = scanResult;
  const primaryParts: string[] = [];
  const secondaryParts: string[] = [];
  const formatOverviewItem = (item: StackItem, nameMap?: Record<string, string>): string =>
    formatItem(item, { ...INIT_OVERVIEW_NAMES, ...nameMap });

  if (scanResult.packages.length > 1) {
    primaryParts.push('monorepo');
    primaryParts.push(`${scanResult.packages.length} packages`);
  } else if (stack.framework) {
    primaryParts.push(formatItem(stack.framework, FRAMEWORK_NAMES));
  } else {
    primaryParts.push('single package');
  }

  primaryParts.push(formatOverviewItem(stack.language));

  if (stack.styling) {
    primaryParts.push(formatOverviewItem(stack.styling, STYLING_NAMES));
  }

  if (stack.packageManager) secondaryParts.push(formatOverviewItem(stack.packageManager));
  if (stack.linter) secondaryParts.push(formatOverviewItem(stack.linter));
  if (stack.formatter) secondaryParts.push(formatOverviewItem(stack.formatter));
  if (stack.testRunner) secondaryParts.push(formatOverviewItem(stack.testRunner));

  const primary = primaryParts.map((part) => chalk.cyan(part)).join(chalk.dim(' · '));
  const secondary = secondaryParts.join(chalk.dim(' · '));

  return secondary ? `${primary}\n  ${chalk.dim(secondary)}` : primary;
}

/**
 * Display a compact init overview right before the decision prompt.
 * Designed to keep the first decision screen short and easy to scan.
 *
 * @param scanResult - The detected project scan result
 * @param config - The generated config
 * @param exemptedPackages - Package paths exempted from coverage
 */
export function displayInitOverview(
  scanResult: ScanResult,
  config: ViberailsConfig,
  exemptedPackages: string[],
): void {
  const root = config.packages.find((p) => p.path === '.') ?? config.packages[0];
  const isMonorepo = config.packages.length > 1;
  const ok = chalk.green('✓');
  const info = chalk.yellow('~');

  console.log('');
  console.log(`  ${chalk.bold('Ready to initialize:')}`);
  console.log(`  ${formatDetectedOverview(scanResult)}`);

  console.log('');
  console.log(`  ${chalk.bold('Rules to apply:')}`);

  // Max file size
  console.log(`  ${ok} Max file size: ${chalk.cyan(`${config.rules.maxFileLines} lines`)}`);

  // File naming — check root first, then any package
  const fileNaming =
    root?.conventions?.fileNaming ??
    config.packages.find((p) => p.conventions?.fileNaming)?.conventions?.fileNaming;
  if (config.rules.enforceNaming && fileNaming) {
    console.log(`  ${ok} File naming: ${chalk.cyan(fileNaming)}`);
  } else {
    console.log(`  ${info} File naming: ${chalk.dim('not enforced')}`);
  }

  // Missing tests — check root first, then any package
  const testPattern =
    root?.structure?.testPattern ??
    config.packages.find((p) => p.structure?.testPattern)?.structure?.testPattern;
  if (config.rules.enforceMissingTests && testPattern) {
    console.log(`  ${ok} Missing tests: ${chalk.cyan(`enforced (${testPattern})`)}`);
  } else if (config.rules.enforceMissingTests) {
    console.log(`  ${ok} Missing tests: ${chalk.cyan('enforced')}`);
  } else {
    console.log(`  ${info} Missing tests: ${chalk.dim('not enforced')}`);
  }

  // Coverage
  if (config.rules.testCoverage > 0) {
    if (isMonorepo) {
      const withCoverage = config.packages.filter(
        (p) => (p.rules?.testCoverage ?? config.rules.testCoverage) > 0,
      );
      console.log(
        `  ${ok} Coverage: ${chalk.cyan(`${config.rules.testCoverage}%`)} default ${chalk.dim(`(${withCoverage.length}/${config.packages.length} packages)`)}`,
      );
    } else {
      console.log(`  ${ok} Coverage: ${chalk.cyan(`${config.rules.testCoverage}%`)}`);
    }
  } else {
    console.log(`  ${info} Coverage: ${chalk.dim('disabled')}`);
  }

  // Exempted packages
  if (exemptedPackages.length > 0) {
    console.log(
      `  ${chalk.dim('  exempted:')} ${chalk.dim(exemptedPackages.join(', '))} ${chalk.dim('(types-only)')}`,
    );
  }

  console.log('');
  console.log(`  ${chalk.bold('Also available:')}`);
  if (isMonorepo) {
    console.log(`  ${info} Infer boundaries from current imports`);
  }
  console.log(`  ${info} Set up hooks, Claude integration, and CI checks`);
  console.log(
    `\n  ${chalk.dim('Defaults warn locally. Use --enforce in CI when you want failures to block.')}`,
  );
  console.log('');
}

export { displayInitOverview as displayInitSummary };

function summarizeSelectedIntegrations(
  integrations: IntegrationChoice,
  opts: { hasBoundaries: boolean; hasCoverage: boolean },
): string[] {
  const lines: string[] = [];

  if (opts.hasBoundaries) {
    lines.push('✓ Boundary rules: inferred from current imports');
  } else {
    lines.push('~ Boundary rules: not enabled');
  }

  if (opts.hasCoverage) {
    lines.push('✓ Coverage checks: enabled');
  } else {
    lines.push('~ Coverage checks: disabled');
  }

  const selectedIntegrations = [
    integrations.preCommitHook ? 'pre-commit hook' : undefined,
    integrations.typecheckHook ? 'typecheck' : undefined,
    integrations.lintHook ? 'lint check' : undefined,
    integrations.claudeCodeHook ? 'Claude Code hook' : undefined,
    integrations.claudeMdRef ? 'CLAUDE.md reference' : undefined,
    integrations.githubAction ? 'GitHub Actions workflow' : undefined,
  ].filter(Boolean);

  if (selectedIntegrations.length > 0) {
    lines.push(`✓ Integrations: ${selectedIntegrations.join(' · ')}`);
  } else {
    lines.push('~ Integrations: none selected');
  }

  return lines;
}

/**
 * Display the final setup plan before files are written.
 */
export function displaySetupPlan(
  config: ViberailsConfig,
  integrations: IntegrationChoice,
  opts: {
    replacingExistingConfig?: boolean;
    configFile?: string;
  } = {},
): void {
  const configFile = opts.configFile ?? 'viberails.config.json';
  const lines = summarizeSelectedIntegrations(integrations, {
    hasBoundaries: config.rules.enforceBoundaries,
    hasCoverage: config.rules.testCoverage > 0,
  });

  console.log('');
  console.log(`  ${chalk.bold('Ready to write:')}`);
  console.log(
    `  ${opts.replacingExistingConfig ? chalk.yellow('!') : chalk.green('✓')} ${configFile}${opts.replacingExistingConfig ? chalk.dim(' (replacing existing config)') : ''}`,
  );
  console.log(`  ${chalk.green('✓')} .viberails/context.md`);
  console.log(`  ${chalk.green('✓')} .viberails/scan-result.json`);
  for (const line of lines) {
    const icon = line.startsWith('✓') ? chalk.green('✓') : chalk.yellow('~');
    console.log(`  ${icon} ${line.slice(2)}`);
  }
  console.log('');
}
