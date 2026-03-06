import { Command } from 'commander';
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
    await initCommand(options);
  });

program
  .command('sync')
  .description('Re-scan and update generated files')
  .action(async () => {
    await syncCommand();
  });

program.parse();
