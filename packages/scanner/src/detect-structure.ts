import type { DetectedConvention, DetectedStructure } from '@viberails/types';
import { confidenceFromConsistency } from '@viberails/types';
import { classifyDirectory } from './utils/classify-directory.js';
import type { WalkedDirectory } from './utils/walk-directory.js';
import { walkDirectory } from './utils/walk-directory.js';

/**
 * Detects the directory structure and organization of a project.
 *
 * Classifies directories by role, detects whether a src/ directory is in use,
 * and identifies test file patterns.
 *
 * @param projectPath - Absolute path to the project root directory.
 * @param dirs - Pre-walked directory list. If not provided, walks the directory tree.
 * @returns The detected directory structure.
 */
export async function detectStructure(
  projectPath: string,
  dirs?: WalkedDirectory[],
): Promise<DetectedStructure> {
  if (!dirs) {
    dirs = await walkDirectory(projectPath, 4);
  }

  // Detect srcDir
  const hasSrcDir = dirs.some((d) => d.relativePath === 'src' || d.relativePath.startsWith('src/'));
  const srcDir = hasSrcDir ? 'src' : undefined;

  // Classify directories
  const directories = dirs.map((d) => classifyDirectory(d)).filter((d) => d !== null);

  // Detect test pattern
  const testPattern = detectTestPattern(dirs);

  return {
    ...(srcDir !== undefined && { srcDir }),
    directories,
    ...(testPattern !== undefined && { testPattern }),
  };
}

/**
 * Detects the dominant test file naming pattern from all source files.
 * Returns undefined if fewer than 3 test files are found.
 */
function detectTestPattern(
  dirs: Array<{ sourceFileNames: string[] }>,
): DetectedConvention<string> | undefined {
  const allFiles = dirs.flatMap((d) => d.sourceFileNames);
  const testFiles = allFiles.filter((f) => f.includes('.test.') || f.includes('.spec.'));

  if (testFiles.length < 3) return undefined;

  const dotTestCount = testFiles.filter((f) => f.includes('.test.')).length;
  const dotSpecCount = testFiles.filter((f) => f.includes('.spec.')).length;

  const isDotTest = dotTestCount >= dotSpecCount;
  const dominantSep = isDotTest ? '.test.' : '.spec.';
  const dominantCount = isDotTest ? dotTestCount : dotSpecCount;
  const consistency = Math.round((dominantCount / testFiles.length) * 100);

  // Find most common extension among dominant test files
  const extCounts = new Map<string, number>();
  for (const f of testFiles.filter((f) => f.includes(dominantSep))) {
    const ext = f.substring(f.lastIndexOf('.'));
    extCounts.set(ext, (extCounts.get(ext) ?? 0) + 1);
  }
  const topExt = [...extCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '.ts';

  const sep = isDotTest ? 'test' : 'spec';

  return {
    value: `*.${sep}${topExt}`,
    confidence: confidenceFromConsistency(consistency),
    sampleSize: testFiles.length,
    consistency,
  };
}
