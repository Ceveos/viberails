import type { BoundaryConfig } from './boundary.js';
import type { Confidence } from './confidence.js';

/**
 * The top-level configuration shape for `viberails.config.json`.
 * Generated from scan results and optionally edited by the user.
 */
export interface ViberailsConfig {
  /** JSON Schema URL for editor validation. */
  $schema?: string;

  /** Config format version. Always `1` for V1.0. */
  version: number;

  /** Project name, typically from package.json. */
  name: string;

  /** Whether conventions are warned about or enforced as errors. */
  enforcement: 'warn' | 'enforce';

  /** Detected or configured technology stack. */
  stack: ConfigStack;

  /** Detected or configured directory structure. */
  structure: ConfigStructure;

  /** Detected or configured coding conventions. */
  conventions: ConfigConventions;

  /** Rule thresholds and toggles for enforcement. */
  rules: ConfigRules;

  /** Glob patterns for files and directories to ignore. */
  ignore: string[];

  /** Module boundary rules for import enforcement. */
  boundaries?: BoundaryConfig;

  /** Workspace configuration for monorepo support (V1.1+). */
  workspace?: WorkspaceConfig;

  /** Per-package overrides for monorepo projects. Only packages that differ from global. */
  packages?: PackageConfigOverrides[];
}

/**
 * Per-package configuration overrides for monorepo projects.
 * Only fields that differ from the global config are included.
 */
export interface PackageConfigOverrides {
  /** Package name from package.json. */
  name: string;
  /** Relative path to the package (e.g. "apps/web"). */
  path: string;
  /** Override stack fields (only differences from global). */
  stack?: Partial<ConfigStack>;
  /** Override conventions (only differences from global). */
  conventions?: Partial<ConfigConventions>;
  /** Override rules (only differences from global). */
  rules?: Partial<ConfigRules>;
  /** Additional ignore patterns for this package (appended to global). */
  ignore?: string[];
}

/**
 * Workspace configuration for monorepo projects.
 */
export interface WorkspaceConfig {
  /** Relative paths to workspace packages (e.g. `"packages/scanner"`). */
  packages: string[];

  /** Whether this project is a monorepo with multiple packages. */
  isMonorepo: boolean;
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
 * to the project root.
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
 * A convention value that may carry scanner metadata.
 * When generated from a scan, includes confidence and consistency info.
 * When manually set, is just a plain string.
 */
export type ConventionValue =
  | string
  | {
      /** The convention value. */
      value: string;
      /** Scanner confidence level. Prefixed with `_` to signal metadata. */
      _confidence: Confidence;
      /** Scanner consistency percentage. Prefixed with `_` to signal metadata. */
      _consistency: number;
      /** Set by mergeConfig when a convention is newly detected during sync. */
      _detected?: boolean;
    };

/**
 * Coding convention configuration. Each field can be a plain string
 * (confirmed by user) or an object with scanner metadata (auto-detected).
 */
export interface ConfigConventions {
  /** File naming convention (e.g. `"kebab-case"`, `"camelCase"`). */
  fileNaming?: ConventionValue;

  /** Component naming convention (e.g. `"PascalCase"`). */
  componentNaming?: ConventionValue;

  /** Hook naming convention (e.g. `"useXxx"`). */
  hookNaming?: ConventionValue;

  /** Import alias pattern (e.g. `"@/*"`, `"~/*"`). */
  importAlias?: ConventionValue;
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
   * Maximum number of lines allowed per function.
   * @default 50
   */
  maxFunctionLines: number;

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
   * @default false (V1.1+ feature)
   */
  enforceBoundaries: boolean;
}
