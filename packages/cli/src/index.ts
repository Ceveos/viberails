import { Command } from 'commander';
import chalk from 'chalk';
import { initCommand } from './commands/init.js';
import { syncCommand } from './commands/sync.js';

export const VERSION = '0.1.0';

const program = new Command();

program
  .name('viberails')
  .description('Guardrails for vibe coding')
  .version(VERSION);

program
  .command('init', { isDefault: true })
  .description('Scan your project and generate AI context files')
  .option('-y, --yes', 'Non-interactive mode (use defaults, high-confidence only)')
  .action(async (options: { yes?: boolean }) => {
    try {
      await initCommand(options);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(chalk.red('Error:') + ' ' + message);
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
      console.error(chalk.red('Error:') + ' ' + message);
      process.exit(1);
    }
  });

program.parse();
