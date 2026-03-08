import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ConfigConventions, ViberailsConfig } from '@viberails/types';
import { BUILTIN_IGNORE } from '@viberails/config';
import picomatch from 'picomatch';

const ALWAYS_SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.expo',
  '.output',
  '.svelte-kit',
  '.turbo',
  'coverage',
  'public',
  'vendor',
  '__generated__',
  'generated',
  '.viberails',
]);

export const SOURCE_EXTS = new Set([
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

export const NAMING_PATTERNS: Record<string, RegExp> = {
  'kebab-case': /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/,
  camelCase: /^[a-z][a-zA-Z0-9]*$/,
  PascalCase: /^[A-Z][a-zA-Z0-9]*$/,
  snake_case: /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/,
};

/** Check if a path matches any ignore pattern. */
export function isIgnored(relPath: string, ignorePatterns: string[]): boolean {
  if (ignorePatterns.length === 0) return false;
  const isMatch = picomatch(ignorePatterns, { dot: true });
  return isMatch(relPath);
}

/** Count lines in a file. Returns null if the file can't be read. */
export function countFileLines(filePath: string): number | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (content.length === 0) return 0;
    let count = 1;
    for (let i = 0; i < content.length; i++) {
      if (content.charCodeAt(i) === 10) count++;
    }
    return count;
  } catch {
    return null;
  }
}

/** Check whether a file's name violates the configured naming convention. */
export function checkNaming(relPath: string, conventions: ConfigConventions): string | undefined {
  const filename = path.basename(relPath);

  // Skip non-source files
  const ext = path.extname(filename);
  if (!SOURCE_EXTS.has(ext)) return undefined;

  // Skip special files
  if (
    filename.startsWith('index.') ||
    filename.includes('.config.') ||
    filename.includes('.test.') ||
    filename.includes('.spec.') ||
    filename.startsWith('.') ||
    filename.startsWith('_') ||
    filename.startsWith('+') ||
    filename.startsWith('$') ||
    filename.startsWith('[')
  ) {
    return undefined;
  }

  const bare = filename.slice(0, filename.indexOf('.'));
  const convention = conventions.fileNaming;
  if (!convention) return undefined;

  const pattern = NAMING_PATTERNS[convention];
  if (!pattern || pattern.test(bare)) return undefined;

  return `File name "${filename}" does not follow ${convention} convention.`;
}

/** Get staged files from git. */
export function getStagedFiles(projectRoot: string): string[] {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
      cwd: projectRoot,
      encoding: 'utf-8',
    });
    return output.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

/** Get all source files in the project. */
export function getAllSourceFiles(projectRoot: string, config: ViberailsConfig): string[] {
  const effectiveIgnore = [...BUILTIN_IGNORE, ...(config.ignore ?? [])];
  const files: string[] = [];
  const walk = (dir: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const rel = path.relative(projectRoot, path.join(dir, entry.name));
      if (entry.isDirectory()) {
        if (ALWAYS_SKIP_DIRS.has(entry.name)) {
          continue;
        }
        if (isIgnored(rel, effectiveIgnore)) continue;
        walk(path.join(dir, entry.name));
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (SOURCE_EXTS.has(ext) && !isIgnored(rel, effectiveIgnore)) {
          files.push(rel);
        }
      }
    }
  };
  walk(projectRoot);
  return files;
}

/** Collect source files from a directory recursively. */
export function collectSourceFiles(dir: string, projectRoot: string): string[] {
  const files: string[] = [];
  const walk = (d: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue;
        walk(path.join(d, entry.name));
      } else if (entry.isFile()) {
        files.push(path.relative(projectRoot, path.join(d, entry.name)));
      }
    }
  };
  walk(dir);
  return files;
}
