import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadConfig, mergeConfig } from '@viberails/config';
import { generateContext, generateCursorrules } from '@viberails/context';
import { scan } from '@viberails/scanner';
import { findProjectRoot } from '../utils/find-project-root.js';

const CONFIG_FILE = 'viberails.config.json';
const CONTEXT_DIR = '.viberails';
const CONTEXT_FILE = 'context.md';

/**
 * Run the viberails sync flow: re-scan, merge config, regenerate context.
 *
 * @param cwd - Working directory override (for testing)
 */
export async function syncCommand(cwd?: string): Promise<void> {
  const startDir = cwd ?? process.cwd();

  // 1. Find project root
  const projectRoot = findProjectRoot(startDir);
  if (!projectRoot) {
    console.error(
      'Could not find a package.json in this directory or any parent directory.',
    );
    process.exit(1);
  }

  // 2. Load existing config
  const configPath = path.join(projectRoot, CONFIG_FILE);
  let existing;
  try {
    existing = await loadConfig(configPath);
  } catch {
    console.error(
      `No ${CONFIG_FILE} found. Run \`npx viberails\` first to initialize.`,
    );
    process.exit(1);
  }

  // 3. Re-scan
  console.log('Scanning project...');
  const scanResult = await scan(projectRoot);

  // 4. Merge config
  const merged = mergeConfig(existing, scanResult);
  fs.writeFileSync(configPath, JSON.stringify(merged, null, 2) + '\n');

  // 5. Regenerate context
  const context = generateContext(merged, scanResult);
  const contextDir = path.join(projectRoot, CONTEXT_DIR);
  if (!fs.existsSync(contextDir)) {
    fs.mkdirSync(contextDir, { recursive: true });
  }
  fs.writeFileSync(path.join(contextDir, CONTEXT_FILE), context);

  // 6. Regenerate .cursorrules
  const cursorrullesLocalPath = path.join(projectRoot, '.cursorrules.local');
  const userCursorrules = fs.existsSync(cursorrullesLocalPath)
    ? fs.readFileSync(cursorrullesLocalPath, 'utf-8')
    : undefined;
  const cursorrules = generateCursorrules(context, userCursorrules);
  fs.writeFileSync(path.join(projectRoot, '.cursorrules'), cursorrules);

  console.log('Synced:');
  console.log(`  ${CONFIG_FILE} — updated`);
  console.log(`  ${CONTEXT_DIR}/${CONTEXT_FILE} — regenerated`);
  console.log('  .cursorrules — regenerated');
}
