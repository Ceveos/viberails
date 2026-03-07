import * as path from 'node:path';
import type {
  ConfigConventions,
  ConfigStack,
  ConfigStructure,
  ConventionValue,
  DetectedConvention,
  DirectoryRole,
  ScanResult,
  StackItem,
  ViberailsConfig,
} from '@viberails/types';
import { DEFAULT_IGNORE, DEFAULT_RULES } from './defaults.js';
import { generatePackageOverrides } from './generate-overrides.js';

/**
 * Format a StackItem as a config string: `"name@version"` or `"name"`.
 */
export function formatStackItem(item: StackItem): string {
  return item.version ? `${item.name}@${item.version}` : item.name;
}

/**
 * Map DetectedStack → ConfigStack by formatting each StackItem.
 */
function mapStack(scanResult: ScanResult): ConfigStack {
  const { stack } = scanResult;
  const config: ConfigStack = {
    language: formatStackItem(stack.language),
    packageManager: formatStackItem(stack.packageManager),
  };

  if (stack.framework) config.framework = formatStackItem(stack.framework);
  if (stack.styling) config.styling = formatStackItem(stack.styling);
  if (stack.backend) config.backend = formatStackItem(stack.backend);
  if (stack.linter) config.linter = formatStackItem(stack.linter);
  if (stack.formatter) config.formatter = formatStackItem(stack.formatter);
  if (stack.testRunner) config.testRunner = formatStackItem(stack.testRunner);

  return config;
}

/** Directory roles that map to ConfigStructure fields. */
const ROLE_TO_FIELD: Partial<Record<DirectoryRole, keyof ConfigStructure>> = {
  pages: 'pages',
  components: 'components',
  hooks: 'hooks',
  utils: 'utils',
  types: 'types',
  tests: 'tests',
};

/**
 * Map DetectedStructure → ConfigStructure by finding the first directory
 * for each known role.
 */
function mapStructure(scanResult: ScanResult): ConfigStructure {
  const { structure } = scanResult;
  const config: ConfigStructure = {};

  if (structure.srcDir) {
    config.srcDir = structure.srcDir;
  }

  for (const dir of structure.directories) {
    const field = ROLE_TO_FIELD[dir.role];
    if (field && config[field] === undefined) {
      (config as Record<string, string>)[field] = dir.path;
    }
  }

  if (structure.testPattern) {
    config.testPattern = structure.testPattern.value;
  }

  return config;
}

/**
 * Convert a DetectedConvention to a ConventionValue with metadata.
 * Returns undefined for low-confidence conventions (they are omitted).
 */
export function mapConvention(convention: DetectedConvention): ConventionValue | undefined {
  if (convention.confidence === 'low') {
    return undefined;
  }

  return {
    value: convention.value,
    _confidence: convention.confidence,
    _consistency: convention.consistency,
  };
}

/** Convention keys from ScanResult that map to ConfigConventions fields. */
export const CONVENTION_KEYS: (keyof ConfigConventions)[] = [
  'fileNaming',
  'componentNaming',
  'hookNaming',
  'importAlias',
];

/**
 * Map scanner conventions → ConfigConventions, omitting low-confidence entries.
 */
function mapConventions(scanResult: ScanResult): ConfigConventions {
  const config: ConfigConventions = {};

  for (const key of CONVENTION_KEYS) {
    const detected = scanResult.conventions[key];
    if (detected) {
      const value = mapConvention(detected);
      if (value !== undefined) {
        config[key] = value;
      }
    }
  }

  return config;
}

/**
 * Generate a ViberailsConfig from scan results.
 *
 * Maps the scanner's DetectedStack, DetectedStructure, and conventions
 * into the config format with smart defaults. Low-confidence conventions
 * are omitted. The project name is derived from the root directory basename.
 *
 * @param scanResult - The output of scanning a project
 * @returns A complete ViberailsConfig ready to be written as JSON
 */
export function generateConfig(scanResult: ScanResult): ViberailsConfig {
  const config: ViberailsConfig = {
    $schema: 'https://viberails.sh/schema/v1.json',
    version: 1,
    name: path.basename(scanResult.root),
    enforcement: 'warn',
    stack: mapStack(scanResult),
    structure: mapStructure(scanResult),
    conventions: mapConventions(scanResult),
    rules: { ...DEFAULT_RULES },
    ignore: [...DEFAULT_IGNORE],
  };

  if (scanResult.workspace) {
    config.workspace = {
      packages: scanResult.workspace.packages.map((p) => p.relativePath),
      isMonorepo: true,
    };
    config.boundaries = [];
  }

  const packageOverrides = generatePackageOverrides(scanResult, config);
  if (packageOverrides) {
    config.packages = packageOverrides;
  }

  return config;
}
