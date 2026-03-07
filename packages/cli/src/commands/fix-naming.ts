import * as fs from 'node:fs';
import * as path from 'node:path';
import { convertName } from './convert-name.js';

export interface RenameRecord {
  oldPath: string;
  newPath: string;
  oldAbsPath: string;
  newAbsPath: string;
}

/**
 * Compute the rename for a file that violates the naming convention.
 * Returns null if no rename is needed or the target already exists.
 */
export function computeRename(
  relPath: string,
  targetConvention: string,
  projectRoot: string,
): RenameRecord | null {
  const filename = path.basename(relPath);
  const dir = path.dirname(relPath);

  // Extract bare name (before first dot) — matches checkNaming logic
  const dotIndex = filename.indexOf('.');
  if (dotIndex === -1) return null;

  const bare = filename.slice(0, dotIndex);
  const suffix = filename.slice(dotIndex); // e.g. ".tsx" or ".test.ts"

  const newBare = convertName(bare, targetConvention);
  if (newBare === bare) return null;

  const newFilename = newBare + suffix;
  const newRelPath = path.join(dir, newFilename);
  const oldAbsPath = path.join(projectRoot, relPath);
  const newAbsPath = path.join(projectRoot, newRelPath);

  // Skip if target already exists
  if (fs.existsSync(newAbsPath)) return null;

  return { oldPath: relPath, newPath: newRelPath, oldAbsPath, newAbsPath };
}

/**
 * Execute a single rename on disk.
 * Returns true if successful, false if skipped (target exists).
 */
export function executeRename(rename: RenameRecord): boolean {
  if (fs.existsSync(rename.newAbsPath)) return false;
  fs.renameSync(rename.oldAbsPath, rename.newAbsPath);
  return true;
}

/**
 * Detect and deduplicate rename collisions.
 * If two planned renames target the same path, the second is removed.
 */
export function deduplicateRenames(renames: RenameRecord[]): RenameRecord[] {
  const seen = new Set<string>();
  const result: RenameRecord[] = [];
  for (const r of renames) {
    if (seen.has(r.newAbsPath)) continue;
    seen.add(r.newAbsPath);
    result.push(r);
  }
  return result;
}
