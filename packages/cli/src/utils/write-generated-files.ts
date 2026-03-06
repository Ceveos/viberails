import * as fs from 'node:fs';
import * as path from 'node:path';
import { generateContext, generateCursorrules } from '@viberails/context';
import type { ScanResult, ViberailsConfig } from '@viberails/types';

const CONTEXT_DIR = '.viberails';
const CONTEXT_FILE = 'context.md';
const SCAN_RESULT_FILE = 'scan-result.json';

/**
 * Write all generated files: context.md, .cursorrules, and scan-result.json.
 *
 * @param projectRoot - Absolute path to the project root
 * @param config - The viberails configuration
 * @param scanResult - The raw scan result
 */
export function writeGeneratedFiles(
  projectRoot: string,
  config: ViberailsConfig,
  scanResult: ScanResult,
): void {
  // Ensure .viberails directory exists
  const contextDir = path.join(projectRoot, CONTEXT_DIR);
  if (!fs.existsSync(contextDir)) {
    fs.mkdirSync(contextDir, { recursive: true });
  }

  // Generate and write context.md
  const context = generateContext(config, scanResult);
  fs.writeFileSync(path.join(contextDir, CONTEXT_FILE), context);

  // Write scan-result.json for drift detection
  fs.writeFileSync(
    path.join(contextDir, SCAN_RESULT_FILE),
    JSON.stringify(scanResult, null, 2) + '\n',
  );

  // Generate and write .cursorrules
  const cursorrulesLocalPath = path.join(projectRoot, '.cursorrules.local');
  const userCursorrules = fs.existsSync(cursorrulesLocalPath)
    ? fs.readFileSync(cursorrulesLocalPath, 'utf-8')
    : undefined;
  const cursorrules = generateCursorrules(context, userCursorrules);
  fs.writeFileSync(path.join(projectRoot, '.cursorrules'), cursorrules);
}
