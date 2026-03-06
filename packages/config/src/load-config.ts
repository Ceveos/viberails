import * as fs from 'node:fs/promises';
import type { ViberailsConfig } from '@viberails/types';

/**
 * Validate that a parsed object has the required ViberailsConfig fields.
 * Throws a descriptive error if any required field is missing.
 */
function validateConfig(parsed: Record<string, unknown>, configPath: string): void {
  const required = ['version', 'name', 'stack', 'rules'] as const;
  const missing = required.filter((field) => parsed[field] === undefined);

  if (missing.length > 0) {
    throw new Error(
      `Invalid viberails config at ${configPath}: missing required field(s): ${missing.join(', ')}`,
    );
  }
}

/**
 * Load and parse a viberails config file.
 *
 * Reads the JSON file at the given path, validates that it contains
 * the required fields (version, name, stack, rules), and returns
 * the parsed config.
 *
 * @param configPath - Absolute or relative path to viberails.config.json
 * @returns The parsed ViberailsConfig
 * @throws If the file doesn't exist, contains invalid JSON, or is missing required fields
 */
export async function loadConfig(configPath: string): Promise<ViberailsConfig> {
  let raw: string;
  try {
    raw = await fs.readFile(configPath, 'utf-8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      throw new Error(`Config file not found: ${configPath}. Run "npx viberails" to generate one.`);
    }
    throw new Error(`Failed to read config file at ${configPath}: ${(err as Error).message}`);
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error(`Invalid JSON in config file at ${configPath}. Check for syntax errors.`);
  }

  validateConfig(parsed, configPath);

  return parsed as unknown as ViberailsConfig;
}

/**
 * Safely load a viberails config file, returning null on any error.
 *
 * Used by the CLI for "does config already exist?" checks where
 * failure is an expected case, not an error.
 *
 * @param configPath - Absolute or relative path to viberails.config.json
 * @returns The parsed ViberailsConfig, or null if loading fails
 */
export async function loadConfigSafe(configPath: string): Promise<ViberailsConfig | null> {
  try {
    return await loadConfig(configPath);
  } catch {
    return null;
  }
}
