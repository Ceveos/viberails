import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

/** Directories to always skip during scanning. */
const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '.viberails',
  'coverage',
  '.turbo',
  '.cache',
  '.output',
]);

/** Source file extensions to count. */
const SOURCE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.vue',
  '.svelte',
  '.astro',
]);

export interface WalkedDirectory {
  /** Path relative to project root, using forward slashes. */
  relativePath: string;
  /** Absolute path. */
  absolutePath: string;
  /** Number of source files directly in this directory. */
  sourceFileCount: number;
  /** Names of source files in this directory. */
  sourceFileNames: string[];
  /** Depth relative to the project root (1 = direct children). */
  depth: number;
}

/**
 * Walks a project directory tree using BFS, collecting directory info.
 *
 * @param projectPath - Absolute path to the project root.
 * @param maxDepth - Maximum directory depth to traverse (default 4).
 * @returns Flat list of all visited directories (excluding root itself).
 */
export async function walkDirectory(
  projectPath: string,
  maxDepth: number = 4,
): Promise<WalkedDirectory[]> {
  const results: WalkedDirectory[] = [];
  const queue: Array<{ absolutePath: string; depth: number }> = [];

  try {
    const rootEntries = await readdir(projectPath, { withFileTypes: true });
    for (const entry of rootEntries) {
      if (entry.isDirectory() && !entry.isSymbolicLink() && !IGNORED_DIRS.has(entry.name)) {
        queue.push({ absolutePath: join(projectPath, entry.name), depth: 1 });
      }
    }
  } catch {
    return results;
  }

  while (queue.length > 0) {
    const { absolutePath, depth } = queue.shift()!;
    const sourceFileNames: string[] = [];

    try {
      const entries = await readdir(absolutePath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isSymbolicLink()) continue;

        if (entry.isDirectory() && depth < maxDepth && !IGNORED_DIRS.has(entry.name)) {
          queue.push({ absolutePath: join(absolutePath, entry.name), depth: depth + 1 });
        } else if (entry.isFile()) {
          const dotIndex = entry.name.lastIndexOf('.');
          if (dotIndex > 0) {
            const ext = entry.name.substring(dotIndex);
            if (SOURCE_EXTENSIONS.has(ext)) {
              sourceFileNames.push(entry.name);
            }
          }
        }
      }
    } catch {
      continue;
    }

    const rel = relative(projectPath, absolutePath).split('\\').join('/');
    results.push({
      relativePath: rel,
      absolutePath,
      sourceFileCount: sourceFileNames.length,
      sourceFileNames,
      depth,
    });
  }

  return results;
}
