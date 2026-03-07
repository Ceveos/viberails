import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { DetectedConvention, DetectedStructure } from '@viberails/types';
import { confidenceFromConsistency } from '@viberails/types';
import { classifyFilename } from './utils/classify-filename.js';
import type { WalkedDirectory } from './utils/walk-directory.js';
import { walkDirectory } from './utils/walk-directory.js';

/**
 * Detects coding conventions used in a project by analyzing file names
 * and configuration files.
 *
 * @param projectPath - Absolute path to the project root directory.
 * @param structure - Previously detected directory structure, used to identify
 *   directories by role.
 * @param dirs - Pre-walked directory list. If not provided, walks the directory tree.
 * @returns A record of detected conventions keyed by convention name.
 *   Only statistical conventions with sampleSize >= 3 are included.
 */
export async function detectConventions(
  projectPath: string,
  structure: DetectedStructure,
  dirs?: WalkedDirectory[],
): Promise<Record<string, DetectedConvention>> {
  if (!dirs) {
    dirs = await walkDirectory(projectPath, 4);
  }

  const result: Record<string, DetectedConvention> = {};

  const fileNaming = detectFileNaming(dirs);
  if (fileNaming) result.fileNaming = fileNaming;

  const componentNaming = detectComponentNaming(dirs, structure);
  if (componentNaming) result.componentNaming = componentNaming;

  const hookNaming = detectHookNaming(dirs, structure);
  if (hookNaming) result.hookNaming = hookNaming;

  // importAlias is binary (present or not) — bypasses sampleSize threshold
  const importAlias = await detectImportAlias(projectPath);
  if (importAlias) result.importAlias = importAlias;

  return result;
}

/** Strips the file extension, handling multi-dot names like foo.test.ts. */
function stripExtension(filename: string): string {
  const firstDot = filename.indexOf('.');
  return firstDot > 0 ? filename.substring(0, firstDot) : filename;
}

/**
 * Detects the dominant file naming convention across all directories
 * with 3+ source files. Only returns conventions with consistency >= 70%
 * (medium or high confidence).
 */
function detectFileNaming(dirs: WalkedDirectory[]): DetectedConvention | undefined {
  const conventionCounts = new Map<string, number>();
  let total = 0;

  for (const dir of dirs) {
    if (dir.sourceFileCount < 3) continue;

    for (const filename of dir.sourceFileNames) {
      if (filename.includes('.test.') || filename.includes('.spec.')) continue;
      const bare = stripExtension(filename);
      if (bare === 'index') continue;

      const convention = classifyFilename(bare);
      total++;
      if (convention !== 'unknown') {
        conventionCounts.set(convention, (conventionCounts.get(convention) ?? 0) + 1);
      }
    }
  }

  if (total < 3) return undefined;

  const sorted = [...conventionCounts.entries()].sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return undefined;

  const [dominantConvention, dominantCount] = sorted[0];
  const consistency = Math.round((dominantCount / total) * 100);
  const confidence = confidenceFromConsistency(consistency);

  if (confidence === 'low') return undefined;

  return {
    value: dominantConvention,
    confidence,
    sampleSize: total,
    consistency,
  };
}

/**
 * Detects component naming convention by checking if .tsx files in
 * component directories use PascalCase filenames.
 */
function detectComponentNaming(
  dirs: WalkedDirectory[],
  structure: DetectedStructure,
): DetectedConvention | undefined {
  const componentPaths = new Set(
    structure.directories.filter((d) => d.role === 'components').map((d) => d.path),
  );

  const tsxFiles: string[] = [];
  for (const dir of dirs) {
    if (!componentPaths.has(dir.relativePath)) continue;
    for (const f of dir.sourceFileNames) {
      if (f.endsWith('.tsx')) tsxFiles.push(f);
    }
  }

  if (tsxFiles.length < 3) return undefined;

  const pascalCount = tsxFiles.filter((f) => /^[A-Z]/.test(stripExtension(f))).length;
  const consistency = Math.round((pascalCount / tsxFiles.length) * 100);
  const dominantValue = pascalCount >= tsxFiles.length / 2 ? 'PascalCase' : 'camelCase';

  return {
    value: dominantValue,
    confidence: confidenceFromConsistency(consistency),
    sampleSize: tsxFiles.length,
    consistency,
  };
}

/**
 * Detects hook naming convention by checking if hook files use
 * kebab-case (use-*) or camelCase (useXxx) prefix.
 */
function detectHookNaming(
  dirs: WalkedDirectory[],
  structure: DetectedStructure,
): DetectedConvention | undefined {
  const hookPaths = new Set(
    structure.directories.filter((d) => d.role === 'hooks').map((d) => d.path),
  );

  const hookFiles: string[] = [];
  for (const dir of dirs) {
    if (!hookPaths.has(dir.relativePath)) continue;
    for (const f of dir.sourceFileNames) {
      const bare = stripExtension(f);
      if (bare.startsWith('use-') || /^use[A-Z]/.test(bare)) {
        hookFiles.push(f);
      }
    }
  }

  if (hookFiles.length < 3) return undefined;

  let kebabCount = 0;
  let camelCount = 0;

  for (const filename of hookFiles) {
    const bare = stripExtension(filename);
    if (bare.startsWith('use-')) {
      kebabCount++;
    } else if (/^use[A-Z]/.test(bare)) {
      camelCount++;
    }
  }

  const total = hookFiles.length;
  const isDominantKebab = kebabCount >= camelCount;
  const dominantCount = isDominantKebab ? kebabCount : camelCount;
  const consistency = Math.round((dominantCount / total) * 100);

  return {
    value: isDominantKebab ? 'use-*' : 'useXxx',
    confidence: confidenceFromConsistency(consistency),
    sampleSize: total,
    consistency,
  };
}

/** Minimal shape for the tsconfig subset we read. */
interface TsConfigSubset {
  compilerOptions?: {
    paths?: Record<string, string[]>;
  };
}

/**
 * Detects import alias patterns from tsconfig.json paths configuration.
 * Returns undefined if tsconfig.json is missing or has no paths.
 */
async function detectImportAlias(projectPath: string): Promise<DetectedConvention | undefined> {
  try {
    const raw = await readFile(join(projectPath, 'tsconfig.json'), 'utf-8');
    const tsconfig = JSON.parse(raw) as TsConfigSubset;
    const paths = tsconfig.compilerOptions?.paths;
    if (!paths) return undefined;

    const aliases = Object.keys(paths);
    if (aliases.length === 0) return undefined;

    return {
      value: aliases.join(','),
      confidence: 'high',
      sampleSize: aliases.length,
      consistency: 100,
    };
  } catch {
    return undefined;
  }
}
