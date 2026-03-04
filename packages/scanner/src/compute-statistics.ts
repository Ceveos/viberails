import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import type { CodebaseStatistics, FileStatistic } from '@viberails/types';
import { walkDirectory } from './utils/walk-directory.js';

/** Source file extensions to include in statistics. */
const SOURCE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.svelte', '.astro',
]);

/**
 * Counts lines in a file by reading its contents.
 *
 * @param filePath - Absolute path to the file.
 * @returns Number of lines, or 0 if the file can't be read.
 */
async function countLines(filePath: string): Promise<number> {
  try {
    const content = await readFile(filePath, 'utf-8');
    if (content.length === 0) return 0;
    // Count newlines; a file with no trailing newline still has 1 line
    let count = 1;
    for (let i = 0; i < content.length; i++) {
      if (content.charCodeAt(i) === 10) count++;
    }
    return count;
  } catch {
    return 0;
  }
}

/**
 * Collects root-level source file names from the project directory.
 *
 * @param projectPath - Absolute path to the project root.
 * @returns Array of source file names in the root directory.
 */
async function getRootSourceFiles(projectPath: string): Promise<string[]> {
  try {
    const entries = await readdir(projectPath, { withFileTypes: true });
    const sourceFiles: string[] = [];
    for (const entry of entries) {
      if (entry.isFile()) {
        const ext = extname(entry.name);
        if (SOURCE_EXTENSIONS.has(ext)) {
          sourceFiles.push(entry.name);
        }
      }
    }
    return sourceFiles;
  } catch {
    return [];
  }
}

/**
 * Computes quantitative statistics about a project's source files.
 *
 * Walks the project directory tree, reads each source file, and produces
 * aggregate metrics including file counts, line counts, and extension breakdown.
 *
 * @param projectPath - Absolute path to the project root.
 * @returns Statistics about the codebase.
 */
export async function computeStatistics(projectPath: string): Promise<CodebaseStatistics> {
  const directories = await walkDirectory(projectPath);
  const rootFiles = await getRootSourceFiles(projectPath);

  // Collect all file paths and extensions
  const filesToProcess: Array<{ relativePath: string; absolutePath: string; ext: string }> = [];

  // Root-level source files
  for (const name of rootFiles) {
    filesToProcess.push({
      relativePath: name,
      absolutePath: join(projectPath, name),
      ext: extname(name),
    });
  }

  // Files from subdirectories
  for (const dir of directories) {
    for (const name of dir.sourceFileNames) {
      filesToProcess.push({
        relativePath: `${dir.relativePath}/${name}`,
        absolutePath: join(dir.absolutePath, name),
        ext: extname(name),
      });
    }
  }

  const totalFiles = filesToProcess.length;

  if (totalFiles === 0) {
    return {
      totalFiles: 0,
      totalLines: 0,
      averageFileLines: 0,
      largestFiles: [],
      filesByExtension: {},
    };
  }

  // Count lines for all files concurrently
  const lineResults = await Promise.all(
    filesToProcess.map(async (file) => ({
      path: file.relativePath,
      lines: await countLines(file.absolutePath),
      ext: file.ext,
    })),
  );

  let totalLines = 0;
  const filesByExtension: Record<string, number> = {};
  const allFiles: FileStatistic[] = [];

  for (const result of lineResults) {
    totalLines += result.lines;
    filesByExtension[result.ext] = (filesByExtension[result.ext] ?? 0) + 1;
    allFiles.push({ path: result.path, lines: result.lines });
  }

  // Sort descending by lines, take top 5
  allFiles.sort((a, b) => b.lines - a.lines);
  const largestFiles = allFiles.slice(0, 5);

  return {
    totalFiles,
    totalLines,
    averageFileLines: Math.round(totalLines / totalFiles),
    largestFiles,
    filesByExtension,
  };
}
