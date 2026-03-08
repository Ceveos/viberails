import type { BoundaryConfig } from './boundary.js';
import type { Confidence } from './confidence.js';

/**
 * The top-level configuration shape for `viberails.config.json`.
 * Generated from scan results and optionally edited by the user.
 */
export interface ViberailsConfig {
  /** JSON Schema URL for editor validation. */
  $schema?: string;

  /** Config format version. Always `2`. */
  version: number;

  /** Project name, typically from package.json. */
  name: string;

  /** Whether conventions are warned about or enforced as errors. */
  enforcement: 'warn' | 'enforce';

  /** Rule thresholds and toggles for enforcement. */
  rules: ConfigRules;

  /** Glob patterns for files and directories to ignore. Project-specific only. */
  ignore?: string[];

  /** Module boundary rules for import enforcement. */
  boundaries?: BoundaryConfig;

  /**
   * Shared defaults for all packages. Packages inherit these values
   * and can override any field. Only present when packages share common config.
   * Written by compactConfig(), consumed by expandDefaults() on load.
   */
  defaults?: ConfigDefaults;

  /**
   * Per-package configs. Required — single projects use `path: "."`.
   * After loading, each package is self-contained (expandDefaults merges defaults in).
   * On disk, stack/structure/conventions may be omitted when covered by defaults.
   */
  packages: PackageConfig[];

  /** Scanner metadata. Regenerated on every sync — not user-editable. */
  _meta?: ConfigMeta;
}

/**
 * Per-package configuration.
 * Self-contained after loading: stack, structure, and conventions are fully populated.
 * On disk, these fields are optional — expandDefaults fills them from defaults.
 */
export interface PackageConfig {
  /** Package name from package.json. */
  name: string;

  /** Relative path to the package (e.g. "apps/web", "." for root). */
  path: string;

  /** Technology stack for this package. Optional on disk, filled by expandDefaults. */
  stack?: ConfigStack;

  /** Directory structure for this package. Optional on disk, filled by expandDefaults. */
  structure?: ConfigStructure;

  /** Coding conventions for this package. Optional on disk, filled by expandDefaults. */
  conventions?: ConfigConventions;

  /** Override rules for this package (only differences from global). */
  rules?: Partial<ConfigRules>;

  /** Additional ignore patterns for this package (appended to global). */
  ignore?: string[];

  /** Per-package boundary rules. */
  boundaries?: PackageBoundary;
}

/**
 * Per-package boundary declaration.
 */
export interface PackageBoundary {
  /** Packages/modules this package must NOT import from. */
  deny: string[];
  /** Files exempt from boundary checks. */
  ignore?: string[];
}

/**
 * Shared default values for all packages. Packages inherit from these
 * and override specific fields. Keeps config DRY when packages share tooling.
 */
export interface ConfigDefaults {
  /** Default technology stack, inherited by all packages. */
  stack?: Partial<ConfigStack>;
  /** Default directory structure, inherited by all packages. */
  structure?: Partial<ConfigStructure>;
  /** Default coding conventions, inherited by all packages. */
  conventions?: ConfigConventions;
}

/**
 * Scanner metadata, separated from user-editable config.
 * Regenerated on every `sync`. Never manually edited.
 */
export interface ConfigMeta {
  /** ISO timestamp of the last sync. */
  lastSync?: string;
  /** Per-package scanner metadata, keyed by package path. */
  packages?: Record<string, PackageMeta>;
}

/** Scanner metadata for a single convention. */
export interface ConventionMeta {
  /** The value detected by the scanner (e.g. "kebab-case"). */
  value: string;
  /** Scanner confidence level. */
  confidence: Confidence;
  /** Consistency percentage (0-100). */
  consistency: number;
  /** Set when a convention is newly detected during sync. */
  detected?: boolean;
}

/** Scanner metadata for a package. */
export interface PackageMeta {
  conventions?: Record<string, ConventionMeta>;
}

/**
 * Technology stack configuration. Each field is a string identifier,
 * optionally with a version suffix (e.g. `"nextjs@15"`, `"typescript"`).
 */
export interface ConfigStack {
  /** Primary framework identifier (e.g. `"nextjs@15"`, `"remix@2"`). */
  framework?: string;

  /** Primary language (e.g. `"typescript"`, `"javascript"`). */
  language: string;

  /** Styling solution (e.g. `"tailwindcss@4"`, `"css-modules"`). */
  styling?: string;

  /** Backend framework (e.g. `"express@5"`, `"fastify"`). */
  backend?: string;

  /** ORM or database client (e.g. `"prisma"`, `"drizzle"`, `"typeorm"`). */
  orm?: string;

  /** Package manager (e.g. `"pnpm"`, `"npm"`, `"yarn"`). */
  packageManager: string;

  /** Linter (e.g. `"eslint@9"`, `"biome"`). */
  linter?: string;

  /** Formatter (e.g. `"prettier"`, `"biome"`). */
  formatter?: string;

  /** Test runner (e.g. `"vitest"`, `"jest"`). */
  testRunner?: string;
}

/**
 * Directory structure configuration. Each field is a path relative
 * to the package root.
 */
export interface ConfigStructure {
  /** Source directory (e.g. `"src"`), or undefined for flat structure. */
  srcDir?: string;

  /** Pages or routes directory (e.g. `"src/app"`, `"pages"`). */
  pages?: string;

  /** Components directory (e.g. `"src/components"`). */
  components?: string;

  /** Hooks directory (e.g. `"src/hooks"`). */
  hooks?: string;

  /** Utilities directory (e.g. `"src/utils"`, `"src/lib"`). */
  utils?: string;

  /** Type definitions directory (e.g. `"src/types"`). */
  types?: string;

  /** Tests directory (e.g. `"tests"`, `"__tests__"`). */
  tests?: string;

  /** Test file naming pattern (e.g. `"*.test.ts"`, `"*.spec.ts"`). */
  testPattern?: string;
}

/**
 * Coding convention configuration. Plain strings only.
 * Scanner metadata lives in `_meta.packages[path].conventions`.
 */
export interface ConfigConventions {
  /** File naming convention (e.g. `"kebab-case"`, `"camelCase"`). */
  fileNaming?: string;

  /** Component naming convention (e.g. `"PascalCase"`). */
  componentNaming?: string;

  /** Hook naming convention (e.g. `"useXxx"`). */
  hookNaming?: string;

  /** Import alias pattern (e.g. `"@/*"`, `"~/*"`). */
  importAlias?: string;
}

/**
 * Rule thresholds and toggles for convention enforcement.
 */
export interface ConfigRules {
  /**
   * Maximum number of lines allowed per file.
   * @default 300
   */
  maxFileLines: number;

  /**
   * Maximum number of lines allowed per test file.
   * Set to 0 to exempt test files from size checks.
   * @default 0
   */
  maxTestFileLines: number;

  /**
   * Whether to require test files for source modules.
   * @default true
   */
  requireTests: boolean;

  /**
   * Whether to enforce detected file naming conventions.
   * @default true
   */
  enforceNaming: boolean;

  /**
   * Whether to enforce module boundary rules.
   * @default false
   */
  enforceBoundaries: boolean;
}
