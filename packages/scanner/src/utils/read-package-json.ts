import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Minimal interface for the fields we read from package.json.
 */
export interface PackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * Safely reads and parses a package.json file from the given directory.
 *
 * @param projectPath - Absolute path to the project root directory.
 * @returns Parsed package.json contents, or `null` if the file doesn't exist or is invalid JSON.
 */
export async function readPackageJson(
  projectPath: string,
): Promise<PackageJson | null> {
  try {
    const raw = await readFile(join(projectPath, 'package.json'), 'utf-8');
    return JSON.parse(raw) as PackageJson;
  } catch {
    return null;
  }
}
