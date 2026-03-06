import * as fs from 'node:fs';
import * as path from 'node:path';
import type { WorkspaceConfig, WorkspacePackage } from '@viberails/types';

/**
 * Resolve WorkspacePackage[] from config workspace relative paths.
 *
 * Reads each package's package.json to get the name and dependencies,
 * then filters internalDeps to only include workspace-internal packages.
 *
 * @param projectRoot - Absolute path to the project root
 * @param workspace - The workspace config from viberails.config.json
 * @returns Array of resolved WorkspacePackage objects
 */
export function resolveWorkspacePackages(
  projectRoot: string,
  workspace: WorkspaceConfig,
): WorkspacePackage[] {
  const packages: WorkspacePackage[] = [];

  for (const relativePath of workspace.packages) {
    const absPath = path.join(projectRoot, relativePath);
    const pkgJsonPath = path.join(absPath, 'package.json');

    if (!fs.existsSync(pkgJsonPath)) continue;

    let pkg: Record<string, unknown>;
    try {
      pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
    } catch {
      continue;
    }

    const name = pkg.name as string;
    if (!name) continue;

    const allDeps = [
      ...Object.keys((pkg.dependencies as Record<string, unknown>) ?? {}),
      ...Object.keys((pkg.devDependencies as Record<string, unknown>) ?? {}),
    ];

    packages.push({ name, path: absPath, relativePath, internalDeps: allDeps });
  }

  // Filter internalDeps to only workspace-internal package names
  const packageNames = new Set(packages.map((p) => p.name));
  for (const pkg of packages) {
    pkg.internalDeps = pkg.internalDeps.filter((dep) => packageNames.has(dep));
  }

  return packages;
}
