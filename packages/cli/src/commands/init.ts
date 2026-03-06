import * as fs from 'node:fs';
import * as path from 'node:path';
import { generateConfig } from '@viberails/config';
import { generateContext, generateCursorrules } from '@viberails/context';
import { scan } from '@viberails/scanner';
import type { ConfigConventions, ConventionValue } from '@viberails/types';
import { displayScanResults } from '../display.js';
import { findProjectRoot } from '../utils/find-project-root.js';
import { confirm } from '../utils/prompt.js';

const CONFIG_FILE = 'viberails.config.json';
const CONTEXT_DIR = '.viberails';
const CONTEXT_FILE = 'context.md';
const IMPORT_DIRECTIVE = '@import .viberails/context.md';

/**
 * Filter a ConfigConventions object to only include high-confidence entries.
 */
function filterHighConfidence(conventions: ConfigConventions): ConfigConventions {
  const filtered: ConfigConventions = {};
  for (const [key, value] of Object.entries(conventions)) {
    if (value === undefined) continue;
    if (typeof value === 'string') {
      filtered[key as keyof ConfigConventions] = value;
    } else if (value._confidence === 'high') {
      filtered[key as keyof ConfigConventions] = value as ConventionValue;
    }
  }
  return filtered;
}

/**
 * Run the viberails init flow.
 *
 * @param options - CLI options
 * @param cwd - Working directory override (for testing)
 */
export async function initCommand(
  options: { yes?: boolean },
  cwd?: string,
): Promise<void> {
  const startDir = cwd ?? process.cwd();

  // 1. Find project root
  const projectRoot = findProjectRoot(startDir);
  if (!projectRoot) {
    console.error(
      'Could not find a package.json in this directory or any parent directory.\n' +
      'Run this command from inside a JavaScript or TypeScript project.',
    );
    process.exit(1);
  }

  // 2. Check for existing config
  const configPath = path.join(projectRoot, CONFIG_FILE);
  if (fs.existsSync(configPath)) {
    console.log(
      'viberails is already initialized. Run `viberails sync` to update.',
    );
    return;
  }

  // 3. Run scanner
  console.log('Scanning project...');
  const scanResult = await scan(projectRoot);

  // 4. Display results
  displayScanResults(scanResult);

  // 5. Interactive confirmation
  if (!options.yes) {
    const accepted = await confirm('Does this look right?');
    if (!accepted) {
      console.log('Aborted.');
      return;
    }
  }

  // 6. Generate config
  const config = generateConfig(scanResult);
  if (options.yes) {
    config.conventions = filterHighConfidence(config.conventions);
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

  // 7. Generate context
  const context = generateContext(config, scanResult);
  const contextDir = path.join(projectRoot, CONTEXT_DIR);
  if (!fs.existsSync(contextDir)) {
    fs.mkdirSync(contextDir, { recursive: true });
  }
  fs.writeFileSync(path.join(contextDir, CONTEXT_FILE), context);

  // 8. Scaffold CLAUDE.md
  const claudeMdPath = path.join(projectRoot, 'CLAUDE.md');
  if (fs.existsSync(claudeMdPath)) {
    const existing = fs.readFileSync(claudeMdPath, 'utf-8');
    if (!existing.includes(IMPORT_DIRECTIVE)) {
      fs.writeFileSync(claudeMdPath, existing.trimEnd() + '\n\n' + IMPORT_DIRECTIVE + '\n');
    }
  } else {
    fs.writeFileSync(
      claudeMdPath,
      `# ${config.name}\n\n${IMPORT_DIRECTIVE}\n`,
    );
  }

  // 9. Generate .cursorrules
  const cursorrullesLocalPath = path.join(projectRoot, '.cursorrules.local');
  const userCursorrules = fs.existsSync(cursorrullesLocalPath)
    ? fs.readFileSync(cursorrullesLocalPath, 'utf-8')
    : undefined;
  const cursorrules = generateCursorrules(context, userCursorrules);
  fs.writeFileSync(path.join(projectRoot, '.cursorrules'), cursorrules);

  // 10. Update .gitignore
  updateGitignore(projectRoot);

  // 11. Print summary
  const created = [
    CONFIG_FILE,
    `${CONTEXT_DIR}/${CONTEXT_FILE}`,
    '.cursorrules',
  ];
  if (!fs.existsSync(claudeMdPath) || true) {
    // CLAUDE.md was either created or updated
  }

  console.log('Created:');
  for (const file of created) {
    console.log(`  ${file}`);
  }
  console.log(`  CLAUDE.md`);
  console.log('\nNext steps:');
  console.log('  1. Review viberails.config.json and adjust as needed');
  console.log('  2. Commit the generated files');
  console.log('  3. Run `viberails sync` after making project changes');
}

/**
 * Append viberails entries to .gitignore if not already present.
 */
function updateGitignore(projectRoot: string): void {
  const gitignorePath = path.join(projectRoot, '.gitignore');
  let content = '';

  if (fs.existsSync(gitignorePath)) {
    content = fs.readFileSync(gitignorePath, 'utf-8');
  }

  const entriesToAdd: string[] = [];
  if (!content.includes('.viberails/')) {
    entriesToAdd.push('.viberails/');
  }
  if (!content.includes('.cursorrules')) {
    entriesToAdd.push('.cursorrules');
  }

  if (entriesToAdd.length > 0) {
    const block = '\n# viberails\n' + entriesToAdd.join('\n') + '\n';
    fs.writeFileSync(gitignorePath, content.trimEnd() + '\n' + block);
  }
}
