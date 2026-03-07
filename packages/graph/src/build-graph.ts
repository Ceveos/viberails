import { relative } from 'node:path';
import type { ImportGraph, ImportGraphNode, WorkspacePackage } from '@viberails/types';
import { Project } from 'ts-morph';
import { detectCycles } from './detect-cycles.js';
import { parseImports } from './parse-imports.js';
import { resolveImport } from './resolve-import.js';

/** Options for building an import graph. */
export interface GraphOptions {
  /** Workspace packages to include in resolution. */
  packages?: WorkspacePackage[];
  /** Glob patterns for files to ignore. */
  ignore?: string[];
  /** Whether to detect import cycles. @default true */
  detectCycles?: boolean;
  /** Path to tsconfig.json. Auto-detected if not provided. */
  tsconfigPath?: string;
}

/** Default glob patterns for files to ignore when building the graph. */
const DEFAULT_IGNORE = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/coverage/**',
];

/**
 * Builds a complete import graph for a project.
 *
 * Creates a ts-morph Project, adds all source files, parses imports,
 * resolves specifiers, and optionally detects cycles.
 *
 * @param projectRoot - Absolute path to the project root.
 * @param options - Configuration options.
 * @returns The complete import graph.
 */
export async function buildImportGraph(
  projectRoot: string,
  options?: GraphOptions,
): Promise<ImportGraph> {
  const packages = options?.packages ?? [];
  const shouldDetectCycles = options?.detectCycles !== false;
  const ignorePatterns = options?.ignore ?? DEFAULT_IGNORE;

  // Create ts-morph project
  const project = new Project({
    tsConfigFilePath: options?.tsconfigPath,
    skipAddingFilesFromTsConfig: true,
  });

  // Add source files from project root and workspace packages
  const sourceGlobs = buildSourceGlobs(projectRoot, packages, ignorePatterns);
  for (const glob of sourceGlobs) {
    project.addSourceFilesAtPaths(glob);
  }

  // Build nodes and edges
  const nodes: ImportGraphNode[] = [];
  const allEdges: ImportGraph['edges'] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();

    // Determine which package this file belongs to
    const ownerPkg = packages.find((pkg) => filePath.startsWith(pkg.path + '/'));

    nodes.push({
      filePath,
      relativePath: relative(ownerPkg?.path ?? projectRoot, filePath),
      packageName: ownerPkg?.name,
    });

    // Parse and resolve imports
    const rawEdges = parseImports(sourceFile);
    for (const edge of rawEdges) {
      const resolved = resolveImport(edge.target, filePath, project, packages);

      // Only include edges with resolved file paths (skip externals/builtins)
      if (resolved.resolvedPath) {
        allEdges.push({
          ...edge,
          target: resolved.resolvedPath,
        });
      } else if (resolved.kind === 'external' || resolved.kind === 'builtin') {
        // Keep external/builtin edges with the specifier as target
        allEdges.push(edge);
      }
    }
  }

  // Detect cycles among internal file edges only
  let cycles: string[][] = [];
  if (shouldDetectCycles) {
    const internalEdges = allEdges.filter(
      (e) => e.target.startsWith('/') && !e.target.includes('node_modules'),
    );
    cycles = detectCycles(internalEdges);
  }

  return { nodes, edges: allEdges, packages, cycles };
}

/**
 * Builds glob patterns for adding source files to the ts-morph project.
 */
function buildSourceGlobs(
  projectRoot: string,
  packages: WorkspacePackage[],
  _ignore: string[],
): string[] {
  const globs: string[] = [];

  if (packages.length > 0) {
    // Add source files from each workspace package
    for (const pkg of packages) {
      globs.push(`${pkg.path}/src/**/*.{ts,tsx,js,jsx}`);
    }
  } else {
    // Single-package project
    globs.push(`${projectRoot}/src/**/*.{ts,tsx,js,jsx}`);
    globs.push(`${projectRoot}/**/*.{ts,tsx,js,jsx}`);
  }

  return globs;
}
