import * as fs from 'node:fs/promises';
import type { ViberailsConfig } from '@viberails/types';
import { expandDefaults } from './compact-config.js';

/**
 * Validate that a parsed object has the required ViberailsConfig fields
 * and that their types are correct.
 * Throws a descriptive error if validation fails.
 */
function validateConfig(parsed: Record<string, unknown>, configPath: string): void {
  const errors: string[] = [];

  // Required top-level fields
  const required = ['version', 'name', 'packages', 'rules'] as const;
  const missing = required.filter((field) => parsed[field] === undefined);
  if (missing.length > 0) {
    throw new Error(
      `Invalid viberails config at ${configPath}: missing required field(s): ${missing.join(', ')}`,
    );
  }

  // Type checks
  if (typeof parsed.version !== 'number') {
    errors.push('"version" must be a number');
  } else if (parsed.version !== 1) {
    errors.push('"version" must be 1');
  }
  if (typeof parsed.name !== 'string') errors.push('"name" must be a string');
  // Packages validation
  if (!Array.isArray(parsed.packages)) {
    errors.push('"packages" must be an array');
  } else if (parsed.packages.length === 0) {
    errors.push('"packages" must contain at least one package');
  } else {
    for (let i = 0; i < parsed.packages.length; i++) {
      const pkg = parsed.packages[i] as Record<string, unknown>;
      if (typeof pkg.name !== 'string') errors.push(`"packages[${i}].name" must be a string`);
      if (typeof pkg.path !== 'string') errors.push(`"packages[${i}].path" must be a string`);
      if (pkg.coverage !== undefined) {
        if (typeof pkg.coverage !== 'object' || pkg.coverage === null) {
          errors.push(`"packages[${i}].coverage" must be an object`);
        } else {
          const coverage = pkg.coverage as Record<string, unknown>;
          if (coverage.command !== undefined && typeof coverage.command !== 'string') {
            errors.push(`"packages[${i}].coverage.command" must be a string`);
          }
          if (coverage.summaryPath !== undefined && typeof coverage.summaryPath !== 'string') {
            errors.push(`"packages[${i}].coverage.summaryPath" must be a string`);
          }
        }
      }
    }
  }

  // Rules validation
  if (typeof parsed.rules !== 'object' || parsed.rules === null) {
    errors.push('"rules" must be an object');
  } else {
    const rules = parsed.rules as Record<string, unknown>;
    if (typeof rules.maxFileLines !== 'number')
      errors.push('"rules.maxFileLines" must be a number');
    else if (rules.maxFileLines < 0) errors.push('"rules.maxFileLines" must be >= 0');
    if (rules.maxTestFileLines !== undefined) {
      if (typeof rules.maxTestFileLines !== 'number') {
        errors.push('"rules.maxTestFileLines" must be a number');
      } else if (rules.maxTestFileLines < 0) {
        errors.push('"rules.maxTestFileLines" must be >= 0');
      }
    }
    if (typeof rules.testCoverage !== 'number')
      errors.push('"rules.testCoverage" must be a number');
    else if (rules.testCoverage < 0 || rules.testCoverage > 100)
      errors.push('"rules.testCoverage" must be between 0 and 100');
    if (typeof rules.enforceNaming !== 'boolean')
      errors.push('"rules.enforceNaming" must be a boolean');
    if (typeof rules.enforceBoundaries !== 'boolean')
      errors.push('"rules.enforceBoundaries" must be a boolean');
  }

  // Ignore validation
  if (parsed.ignore !== undefined && !Array.isArray(parsed.ignore)) {
    errors.push('"ignore" must be an array');
  }

  // Defaults validation
  if (parsed.defaults !== undefined) {
    if (typeof parsed.defaults !== 'object' || parsed.defaults === null) {
      errors.push('"defaults" must be an object');
    } else {
      const defaults = parsed.defaults as Record<string, unknown>;
      if (defaults.coverage !== undefined) {
        if (typeof defaults.coverage !== 'object' || defaults.coverage === null) {
          errors.push('"defaults.coverage" must be an object');
        } else {
          const coverage = defaults.coverage as Record<string, unknown>;
          if (coverage.command !== undefined && typeof coverage.command !== 'string') {
            errors.push('"defaults.coverage.command" must be a string');
          }
          if (coverage.summaryPath !== undefined && typeof coverage.summaryPath !== 'string') {
            errors.push('"defaults.coverage.summaryPath" must be a string');
          }
        }
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid viberails config at ${configPath}: ${errors.join('; ')}`);
  }
}

/**
 * Load and parse a viberails config file.
 *
 * Reads the JSON file at the given path, validates that it contains
 * the required fields (version, name, packages, rules), expands
 * defaults into packages, and returns the parsed config.
 *
 * @param configPath - Absolute or relative path to viberails.config.json
 * @returns The parsed ViberailsConfig with defaults expanded
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

  // Apply defaults for optional fields added after initial release
  const rules = parsed.rules as Record<string, unknown>;
  if (rules.maxTestFileLines === undefined) {
    rules.maxTestFileLines = 0;
  }

  // Default ignore to [] if missing
  if (parsed.ignore === undefined) {
    parsed.ignore = [];
  }

  // Safe to cast: validateConfig has verified all required fields and types
  let config = parsed as unknown as ViberailsConfig;

  // Expand defaults into packages so they are self-contained
  config = expandDefaults(config);

  return config;
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
