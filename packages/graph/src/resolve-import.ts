import type { ImportKind, WorkspacePackage } from '@viberails/types';
import { builtinModules } from 'node:module';
import { dirname, resolve } from 'node:path';
import type { Project } from 'ts-morph';

/** Result of resolving an import specifier. */
export interface ResolvedImport {
  /** Classification of the import. */
  kind: ImportKind;
  /** Absolute path for internal/workspace imports. */
  resolvedPath?: string;
  /** Package name for workspace/external imports. */
  packageName?: string;
}

/** Set of Node.js builtin module names (with and without node: prefix). */
const BUILTINS = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)]);

/**
 * Resolves an import specifier and classifies it.
 *
 * Classification order:
 * 1. `node:` prefix or known builtin → `builtin`
 * 2. Matches a workspace package name → `workspace`
 * 3. Relative path (`.` or `/`) → resolve via ts-morph → `internal`
 * 4. Otherwise → `external`
 * 5. If resolution fails → `unresolved`
 *
 * @param specifier - The raw import specifier as written in source.
 * @param fromFile - Absolute path of the file containing the import.
 * @param project - ts-morph Project for resolution.
 * @param workspacePackages - Known workspace packages for monorepo resolution.
 * @returns Classification and resolved path information.
 */
export function resolveImport(
  specifier: string,
  fromFile: string,
  project: Project,
  workspacePackages: WorkspacePackage[],
): ResolvedImport {
  // 1. Node.js builtins
  if (BUILTINS.has(specifier)) {
    return { kind: 'builtin' };
  }

  // 2. Workspace packages
  const wsMatch = workspacePackages.find(
    (pkg) => specifier === pkg.name || specifier.startsWith(`${pkg.name}/`),
  );
  if (wsMatch) {
    return {
      kind: 'workspace',
      resolvedPath: wsMatch.path,
      packageName: wsMatch.name,
    };
  }

  // 3. Relative or absolute imports → internal
  if (specifier.startsWith('.') || specifier.startsWith('/')) {
    const resolved = tryResolve(specifier, fromFile, project);
    if (resolved) {
      return { kind: 'internal', resolvedPath: resolved };
    }
    return { kind: 'unresolved' };
  }

  // 4. Check if ts-morph can resolve it (e.g. path aliases)
  const aliasResolved = tryResolve(specifier, fromFile, project);
  if (aliasResolved) {
    return { kind: 'internal', resolvedPath: aliasResolved };
  }

  // 5. External package
  return { kind: 'external', packageName: specifier.split('/')[0] };
}

/**
 * Attempts to resolve a specifier using ts-morph's module resolution.
 * Returns the absolute path if resolved, undefined otherwise.
 */
function tryResolve(specifier: string, fromFile: string, project: Project): string | undefined {
  // Try ts-morph resolution first
  const sourceFile = project.getSourceFile(fromFile);
  if (sourceFile) {
    // Try common TypeScript extensions
    const dir = dirname(fromFile);
    const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'];

    for (const ext of extensions) {
      const candidate = specifier.startsWith('.') ? resolve(dir, specifier + ext) : specifier + ext;
      const found = project.getSourceFile(candidate);
      if (found) return found.getFilePath();
    }
  }

  return undefined;
}
