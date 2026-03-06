/** A node in the import graph, representing one source file. */
export interface ImportGraphNode {
  /** Absolute path to the file. */
  filePath: string;

  /** Path relative to the project or package root. */
  relativePath: string;

  /** Workspace package this file belongs to, if any. */
  packageName?: string;
}

/** A single resolved import edge. */
export interface ImportEdge {
  /** Absolute path of the importing file. */
  source: string;

  /** Absolute path or package name for externals. */
  target: string;

  /** Raw import specifier as written in source code. */
  specifier: string;

  /** Whether this is a type-only import (`import type { ... }`). */
  typeOnly: boolean;

  /** Whether this is a dynamic import (`await import('...')`). */
  dynamic: boolean;

  /** Line number of the import statement. */
  line: number;
}

/** Classification of a resolved import. */
export type ImportKind = 'internal' | 'workspace' | 'external' | 'builtin' | 'unresolved';

/** The complete import graph for a project. */
export interface ImportGraph {
  /** All source file nodes in the graph. */
  nodes: ImportGraphNode[];

  /** All import edges between nodes. */
  edges: ImportEdge[];

  /** Detected workspace packages. */
  packages: WorkspacePackage[];

  /** Detected import cycles, each as a list of file paths. */
  cycles: string[][];
}

/** A detected workspace package. */
export interface WorkspacePackage {
  /** Package name from package.json. */
  name: string;

  /** Absolute path to the package root. */
  path: string;

  /** Path relative to the workspace root. */
  relativePath: string;

  /** Names of other workspace packages this package depends on. */
  internalDeps: string[];
}
