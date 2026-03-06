import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Walk up from startDir looking for a directory containing package.json.
 *
 * @param startDir - The directory to start searching from
 * @returns The project root path, or null if no package.json is found
 */
export function findProjectRoot(startDir: string): string | null {
  let dir = path.resolve(startDir);

  while (true) {
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      return dir;
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}
