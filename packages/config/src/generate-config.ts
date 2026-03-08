import * as path from 'node:path';
import type {
  ConfigConventions,
  ConfigMeta,
  ConfigStack,
  ConfigStructure,
  ConventionMeta,
  DetectedConvention,
  DirectoryRole,
  PackageConfig,
  ScanResult,
  StackItem,
  ViberailsConfig,
} from '@viberails/types';
import { DEFAULT_IGNORE, DEFAULT_RULES } from './defaults.js';
import { generatePackages } from './generate-packages.js';

/**
 * Format a StackItem as a config string: `"name@version"` or `"name"`.
 */
export function formatStackItem(item: StackItem): string {
  return item.version ? `${item.name}@${item.version}` : item.name;
}

/**
 * Map DetectedStack → ConfigStack by formatting each StackItem.
 */
export function mapStack(scanResult: ScanResult): ConfigStack {
  const { stack } = scanResult;
  const config: ConfigStack = {
    language: formatStackItem(stack.language),
    packageManager: formatStackItem(stack.packageManager),
  };

  if (stack.framework) config.framework = formatStackItem(stack.framework);
  if (stack.styling) config.styling = formatStackItem(stack.styling);
  if (stack.backend) config.backend = formatStackItem(stack.backend);
  if (stack.orm) config.orm = formatStackItem(stack.orm);
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
export function mapStructure(scanResult: ScanResult): ConfigStructure {
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

/** Convention keys from ScanResult that map to ConfigConventions fields. */
export const CONVENTION_KEYS: (keyof ConfigConventions)[] = [
  'fileNaming',
  'componentNaming',
  'hookNaming',
  'importAlias',
];

/**
 * Map scanner conventions → ConfigConventions as plain strings.
 * Low-confidence conventions are omitted.
 * Returns both the plain-string conventions and the metadata for _meta.
 */
function mapConventions(scanResult: ScanResult): {
  conventions: ConfigConventions;
  meta: Record<string, ConventionMeta>;
} {
  const conventions: ConfigConventions = {};
  const meta: Record<string, ConventionMeta> = {};

  for (const key of CONVENTION_KEYS) {
    const detected = scanResult.conventions[key];
    if (detected && detected.confidence !== 'low') {
      conventions[key] = detected.value;
      meta[key] = {
        value: detected.value,
        confidence: detected.confidence,
        consistency: detected.consistency,
      };
    }
  }

  return { conventions, meta };
}

/**
 * Build _meta for a single package's conventions.
 */
export function buildConventionMeta(
  conventions: Record<string, DetectedConvention>,
): Record<string, ConventionMeta> {
  const meta: Record<string, ConventionMeta> = {};
  for (const key of CONVENTION_KEYS) {
    const detected = conventions[key];
    if (detected && detected.confidence !== 'low') {
      meta[key] = {
        value: detected.value,
        confidence: detected.confidence,
        consistency: detected.consistency,
      };
    }
  }
  return meta;
}

/**
 * Generate a ViberailsConfig from scan results.
 *
 * Produces the packages-first config format: all config lives in `packages[]`.
 * Single projects get one package with `path: "."`.
 * Monorepos get one package per workspace package.
 *
 * @param scanResult - The output of scanning a project
 * @returns A complete ViberailsConfig ready to be written as JSON
 */
export function generateConfig(scanResult: ScanResult): ViberailsConfig {
  const projectName = path.basename(scanResult.root);
  const { conventions, meta } = mapConventions(scanResult);

  // Build the root package
  const rootPackage: PackageConfig = {
    name: projectName,
    path: '.',
    stack: mapStack(scanResult),
    structure: mapStructure(scanResult),
    conventions,
  };

  const _meta: ConfigMeta = {
    lastSync: new Date().toISOString(),
    packages: {
      '.': { conventions: Object.keys(meta).length > 0 ? meta : undefined },
    },
  };

  const config: ViberailsConfig = {
    $schema: 'https://viberails.sh/schema/v1.json',
    version: 1,
    name: projectName,
    rules: { ...DEFAULT_RULES },
    ignore: [...DEFAULT_IGNORE],
    packages: [rootPackage],
    _meta,
  };

  // Monorepo: generate per-package configs
  if (scanResult.workspace) {
    const packages = generatePackages(scanResult, config);
    if (packages) {
      config.packages = packages;
      // Rebuild _meta for all packages
      const pkgMeta: Record<string, { conventions?: Record<string, ConventionMeta> }> = {};
      for (const pkg of scanResult.packages) {
        const convMeta = buildConventionMeta(pkg.conventions);
        if (Object.keys(convMeta).length > 0) {
          pkgMeta[pkg.relativePath] = { conventions: convMeta };
        }
      }
      if (Object.keys(pkgMeta).length > 0) {
        _meta.packages = pkgMeta;
      }
    }
    config.boundaries = { deny: {} };
  }

  return config;
}
