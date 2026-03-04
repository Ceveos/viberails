import type { Confidence, DirectoryRole } from '@viberails/types';
import type { WalkedDirectory } from './walk-directory.js';

export interface ClassifiedDirectory {
  path: string;
  role: DirectoryRole;
  fileCount: number;
  confidence: Confidence;
}

interface RolePattern {
  role: DirectoryRole;
  pathPatterns: string[];
}

const ROLE_PATTERNS: RolePattern[] = [
  { role: 'pages', pathPatterns: ['src/app', 'src/pages', 'app', 'pages'] },
  { role: 'components', pathPatterns: ['src/components', 'components'] },
  { role: 'hooks', pathPatterns: ['src/hooks', 'hooks'] },
  { role: 'utils', pathPatterns: ['src/lib', 'src/utils', 'src/helpers', 'lib', 'utils', 'helpers'] },
  { role: 'types', pathPatterns: ['src/types', 'types', 'src/@types', '@types'] },
  { role: 'tests', pathPatterns: ['__tests__', 'tests', 'test', 'src/__tests__', 'src/tests'] },
  { role: 'styles', pathPatterns: ['src/styles', 'styles', 'src/css', 'css'] },
  { role: 'api', pathPatterns: ['src/api', 'api', 'src/app/api', 'app/api'] },
  { role: 'config', pathPatterns: ['config', 'src/config'] },
];

/**
 * Classifies a directory by its role in the project.
 *
 * @param dir - A walked directory entry.
 * @returns Classified directory info, or null if the directory should be skipped.
 */
export function classifyDirectory(dir: WalkedDirectory): ClassifiedDirectory | null {
  // Try name-based matching first
  const nameMatch = matchByName(dir.relativePath);
  if (nameMatch) {
    const confidence: Confidence = dir.sourceFileCount > 0 ? 'high' : 'low';
    return {
      path: dir.relativePath,
      role: nameMatch,
      fileCount: dir.sourceFileCount,
      confidence,
    };
  }

  // Skip directories with no source files if no name match
  if (dir.sourceFileCount === 0) return null;

  // Content-based heuristics
  const contentRole = inferFromContent(dir);
  if (contentRole) return contentRole;

  // Has source files but no classification
  return {
    path: dir.relativePath,
    role: 'unknown',
    fileCount: dir.sourceFileCount,
    confidence: 'low',
  };
}

/**
 * Matches a relative path against known role patterns.
 * Returns the role if matched, or null.
 */
function matchByName(relativePath: string): DirectoryRole | null {
  for (const { role, pathPatterns } of ROLE_PATTERNS) {
    for (const pattern of pathPatterns) {
      if (relativePath === pattern) return role;
    }
  }
  return null;
}

/**
 * Infers directory role from file contents/names.
 */
function inferFromContent(dir: WalkedDirectory): ClassifiedDirectory | null {
  const { sourceFileNames, sourceFileCount } = dir;

  // Check for hook files (use* prefix)
  const hookFiles = sourceFileNames.filter((f) => {
    const name = f.split('.')[0];
    return name.startsWith('use-') || name.startsWith('use');
  });
  if (hookFiles.length > 0 && hookFiles.length / sourceFileCount >= 0.5) {
    return {
      path: dir.relativePath,
      role: 'hooks',
      fileCount: sourceFileCount,
      confidence: hookFiles.length / sourceFileCount >= 0.9 ? 'high' : 'medium',
    };
  }

  // Check for test files
  const testFiles = sourceFileNames.filter(
    (f) => f.includes('.test.') || f.includes('.spec.'),
  );
  if (testFiles.length > 0 && testFiles.length / sourceFileCount >= 0.5) {
    return {
      path: dir.relativePath,
      role: 'tests',
      fileCount: sourceFileCount,
      confidence: testFiles.length / sourceFileCount >= 0.9 ? 'high' : 'medium',
    };
  }

  return null;
}
