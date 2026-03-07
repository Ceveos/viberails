import * as fs from 'node:fs';
import * as path from 'node:path';
import { generateContext } from '@viberails/context';
import type { ScanResult, ViberailsConfig } from '@viberails/types';

const CONTEXT_DIR = '.viberails';
const CONTEXT_FILE = 'context.md';
const SCAN_RESULT_FILE = 'scan-result.json';

/**
 * Write all generated files: context.md and scan-result.json.
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
  const contextDir = path.join(projectRoot, CONTEXT_DIR);

  try {
    if (!fs.existsSync(contextDir)) {
      fs.mkdirSync(contextDir, { recursive: true });
    }

    const context = generateContext(config);
    fs.writeFileSync(path.join(contextDir, CONTEXT_FILE), context);

    fs.writeFileSync(
      path.join(contextDir, SCAN_RESULT_FILE),
      `${JSON.stringify(scanResult, null, 2)}\n`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to write generated files to ${contextDir}: ${message}`);
  }
}
