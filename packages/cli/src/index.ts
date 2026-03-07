import chalk from 'chalk';
import { Command } from 'commander';
import { boundariesCommand } from './commands/boundaries.js';
import { checkCommand } from './commands/check.js';
import { fixCommand } from './commands/fix.js';
import { initCommand } from './commands/init.js';
import { syncCommand } from './commands/sync.js';

export const VERSION = '0.1.0';

const program = new Command();

program.name('viberails').description('Guardrails for vibe coding').version(VERSION);

program
  .command('init', { isDefault: true })
  .description('Scan your project and set up enforcement guardrails')
  .option('-y, --yes', 'Non-interactive mode (use defaults, high-confidence only)')
  .action(async (options: { yes?: boolean }) => {
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
  .action(async (options: { staged?: boolean; files?: string[]; boundaries?: boolean }) => {
    try {
      const exitCode = await checkCommand({
        ...options,
        noBoundaries: options.boundaries === false,
      });
      process.exit(exitCode);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`${chalk.red('Error:')} ${message}`);
      process.exit(1);
    }
  });

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
