import type { Confidence, DetectedConvention } from './confidence.js';
import type { WorkspacePackage } from './graph.js';

/**
 * The complete output of scanning a project. Consumed by the config
 * generator and context generator to produce AI context files.
 */
export interface ScanResult {
  /** Absolute path to the project root directory. */
  root: string;

  /** Detected technology stack (framework, language, tooling). */
  stack: DetectedStack;

  /** Detected directory structure and organization. */
  structure: DetectedStructure;

  /** Detected coding conventions, keyed by convention name. */
  conventions: Record<string, DetectedConvention>;

  /** Quantitative statistics about the codebase. */
  statistics: CodebaseStatistics;

  /** Detected workspace information for monorepo projects (V1.1+). */
  workspace?: DetectedWorkspace;

  /**
   * Per-package scan results. Always has at least one entry.
   * For single-package projects, contains one entry identical to the top-level fields.
   * For monorepos, contains one entry per workspace package.
   */
  packages: PackageScanResult[];
}

/**
 * Scan results for a single package within a workspace,
 * or the root of a single-package project.
 */
export interface PackageScanResult {
  /** Package name from package.json. */
  name: string;
  /** Absolute path to this package's root directory. */
  root: string;
  /** Path relative to the workspace root. Empty string for single-package projects. */
  relativePath: string;
  /** Detected technology stack for this package. */
  stack: DetectedStack;
  /** Detected directory structure within this package. */
  structure: DetectedStructure;
  /** Detected coding conventions for this package. */
  conventions: Record<string, DetectedConvention>;
  /** Quantitative statistics for this package. */
  statistics: CodebaseStatistics;
}

/**
 * Workspace information detected by scanning the project root
 * for pnpm-workspace.yaml or package.json workspaces field.
 */
export interface DetectedWorkspace {
  /** Workspace glob patterns from configuration (e.g. `["packages/*"]`). */
  patterns: string[];

  /** Resolved workspace packages. */
  packages: WorkspacePackage[];
}

/**
 * The detected technology stack of a project, extracted primarily
 * from package.json dependencies and configuration files.
 */
export interface DetectedStack {
  /** Primary framework (e.g. Next.js, Remix, Astro). */
  framework?: StackItem;

  /** Primary language (e.g. TypeScript, JavaScript). */
  language: StackItem;

  /** Styling solution (e.g. Tailwind CSS, CSS Modules). */
  styling?: StackItem;

  /** Backend framework or runtime (e.g. Express, Fastify). */
  backend?: StackItem;

  /** Package manager used (e.g. pnpm, npm, yarn). */
  packageManager: StackItem;

  /** Linter in use (e.g. ESLint, Biome). */
  linter?: StackItem;

  /** Formatter in use (e.g. Prettier, Biome). */
  formatter?: StackItem;

  /** Test runner in use (e.g. Vitest, Jest). */
  testRunner?: StackItem;

  /** Notable libraries detected (e.g. Zod, tRPC, React Query). */
  libraries: StackItem[];
}

/**
 * A single technology or tool detected in the project.
 */
export interface StackItem {
  /** Identifier name of the tool or technology. */
  name: string;

  /** Detected version, if available. */
  version?: string;
}

/**
 * The detected directory structure and organization of a project.
 */
export interface DetectedStructure {
  /** Source directory name (e.g. `'src'`), or undefined if the project uses a flat structure. */
  srcDir?: string;

  /** Detected meaningful directories with their roles. */
  directories: DirectoryInfo[];

  /** Detected test file naming pattern (e.g. `*.test.ts`, `*.spec.ts`). */
  testPattern?: DetectedConvention<string>;
}

/**
 * Information about a detected directory and its inferred role.
 */
export interface DirectoryInfo {
  /** Path relative to the project root. */
  path: string;

  /** The inferred role of this directory. */
  role: DirectoryRole;

  /** Number of files in this directory (non-recursive). */
  fileCount: number;

  /** How confident the scanner is in the role assignment. */
  confidence: Confidence;
}

/**
 * The inferred role of a directory in the project structure.
 */
export type DirectoryRole =
  | 'pages'
  | 'components'
  | 'hooks'
  | 'utils'
  | 'types'
  | 'tests'
  | 'styles'
  | 'api'
  | 'config'
  | 'unknown';

/**
 * Quantitative statistics about the codebase.
 */
export interface CodebaseStatistics {
  /** Total number of source files. */
  totalFiles: number;

  /** Total number of lines across all source files. */
  totalLines: number;

  /** Average number of lines per file. */
  averageFileLines: number;

  /** Top 5 largest files by line count. */
  largestFiles: FileStatistic[];

  /** File count grouped by extension (e.g. `{ '.ts': 42, '.tsx': 18 }`). */
  filesByExtension: Record<string, number>;
}

/**
 * Line count information for a single file.
 */
export interface FileStatistic {
  /** Path relative to the project root. */
  path: string;

  /** Number of lines in the file. */
  lines: number;
}
