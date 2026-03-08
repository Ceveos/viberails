import chalk from 'chalk';
import { Command } from 'commander';
import { boundariesCommand } from './commands/boundaries.js';
import { checkCommand } from './commands/check.js';
import { fixCommand } from './commands/fix.js';
import { initCommand } from './commands/init.js';
import { syncCommand } from './commands/sync.js';

declare const __PACKAGE_VERSION__: string;
export const VERSION: string = __PACKAGE_VERSION__;

const program = new Command();

program.name('viberails').description('Guardrails for vibe coding').version(VERSION);

program
  .command('init', { isDefault: true })
  .description('Scan your project and set up enforcement guardrails')
  .option('-y, --yes', 'Non-interactive mode (use defaults, high-confidence only)')
  .option('-f, --force', 'Re-initialize, replacing existing config')
  .action(async (options: { yes?: boolean; force?: boolean }) => {
    try {
      await initCommand(options);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`${chalk.red('Error:')} ${message}`);
      process.exit(1);
    }
  });

program
  .command('sync')
  .description('Re-scan and update generated files')
  .action(async () => {
    try {
      await syncCommand();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`${chalk.red('Error:')} ${message}`);
      process.exit(1);
    }
  });

program
  .command('check')
  .description('Check files against enforced rules')
  .option('--staged', 'Check only staged files (for pre-commit hooks)')
  .option('--files <files...>', 'Check specific files')
  .option('--no-boundaries', 'Skip boundary checking')
  .option('--quiet', 'Show only summary counts, not individual violations')
  .option('--limit <n>', 'Maximum number of violations to display', Number.parseInt)
  .option('--format <format>', 'Output format: text (default) or json')
  .action(
    async (options: {
      staged?: boolean;
      files?: string[];
      boundaries?: boolean;
      quiet?: boolean;
      limit?: number;
      format?: string;
    }) => {
      try {
        const exitCode = await checkCommand({
          ...options,
          noBoundaries: options.boundaries === false,
          format: options.format === 'json' ? 'json' : 'text',
        });
        process.exit(exitCode);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`${chalk.red('Error:')} ${message}`);
        process.exit(1);
      }
    },
  );

program
  .command('fix')
  .description('Auto-fix file naming violations and generate missing test stubs')
  .option('--dry-run', 'Show planned fixes without applying them')
  .option('--rule <rules...>', 'Fix only specific rules (file-naming, missing-test)')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(async (options: { dryRun?: boolean; rule?: string[]; yes?: boolean }) => {
    try {
      const exitCode = await fixCommand(options);
      process.exit(exitCode);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`${chalk.red('Error:')} ${message}`);
      process.exit(1);
    }
  });

program
  .command('boundaries')
  .description('Display, infer, or inspect import boundary rules')
  .option('--infer', 'Infer boundary rules from current import patterns')
  .option('--graph', 'Display import graph summary')
  .action(async (options: { infer?: boolean; graph?: boolean }) => {
    try {
      await boundariesCommand(options);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`${chalk.red('Error:')} ${message}`);
      process.exit(1);
    }
  });

program.parse();
