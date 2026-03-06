import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type { DetectedWorkspace, WorkspacePackage } from '@viberails/types';
import { readPackageJson } from './utils/read-package-json.js';

/**
 * Detects workspace configuration for monorepo projects.
 *
 * Checks for `pnpm-workspace.yaml` first, then falls back to
 * `package.json` `workspaces` field. Returns `undefined` for
 * single-package projects.
 *
 * @param projectRoot - Absolute path to the project root.
 * @returns Detected workspace info, or `undefined` if not a monorepo.
 */
export async function detectWorkspace(projectRoot: string): Promise<DetectedWorkspace | undefined> {
  const patterns = await readWorkspacePatterns(projectRoot);
  if (!patterns || patterns.length === 0) return undefined;

  const packageDirs = await resolvePatterns(projectRoot, patterns);
  const packages = await resolvePackages(projectRoot, packageDirs);

  if (packages.length === 0) return undefined;

  // Resolve internal deps: check if any dependency name matches a workspace package
  const packageNames = new Set(packages.map((p) => p.name));
  for (const pkg of packages) {
    pkg.internalDeps = pkg.internalDeps.filter((dep) => packageNames.has(dep));
  }

  return { patterns, packages };
}

/**
 * Reads workspace glob patterns from pnpm-workspace.yaml or package.json.
 */
async function readWorkspacePatterns(projectRoot: string): Promise<string[] | undefined> {
  // Try pnpm-workspace.yaml first
  try {
    const yaml = await readFile(join(projectRoot, 'pnpm-workspace.yaml'), 'utf-8');
    return parsePnpmWorkspaceYaml(yaml);
  } catch {
    // Not found, try package.json
  }

  // Fall back to package.json workspaces field
  const pkg = await readPackageJson(projectRoot);
  if (!pkg) return undefined;

  const raw = pkg as Record<string, unknown>;
  const workspaces = raw.workspaces;

  if (Array.isArray(workspaces)) {
    return workspaces.filter((w): w is string => typeof w === 'string');
  }

  // Handle { packages: [...] } format
  if (workspaces && typeof workspaces === 'object' && 'packages' in workspaces) {
    const nested = (workspaces as { packages: unknown }).packages;
    if (Array.isArray(nested)) {
      return nested.filter((w): w is string => typeof w === 'string');
    }
  }

  return undefined;
}

/**
 * Parses workspace patterns from pnpm-workspace.yaml content.
 * Handles the common format: `packages:\n  - 'packages/*'`
 */
function parsePnpmWorkspaceYaml(content: string): string[] {
  const patterns: string[] = [];
  let inPackages = false;

  for (const line of content.split('\n')) {
    const trimmed = line.trim();

    if (trimmed === 'packages:') {
      inPackages = true;
      continue;
    }

    // Stop at next top-level key
    if (inPackages && trimmed.length > 0 && !trimmed.startsWith('-')) {
      break;
    }

    if (inPackages && trimmed.startsWith('-')) {
      // Extract the pattern, stripping quotes and leading dash
      const value = trimmed
        .slice(1)
        .trim()
        .replace(/^['"]|['"]$/g, '');
      if (value) patterns.push(value);
    }
  }

  return patterns;
}

/**
 * Resolves workspace glob patterns to actual directory paths.
 * Supports simple `*` wildcard matching (e.g. `packages/*`).
 */
async function resolvePatterns(projectRoot: string, patterns: string[]): Promise<string[]> {
  const dirs: string[] = [];

  for (const pattern of patterns) {
    if (pattern.endsWith('/*')) {
      // Simple wildcard: list children of the parent directory
      const parent = join(projectRoot, pattern.slice(0, -2));
      try {
        const entries = await readdir(parent, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            dirs.push(join(parent, entry.name));
          }
        }
      } catch {
        // Parent directory doesn't exist, skip
      }
    } else {
      // Literal path
      dirs.push(join(projectRoot, pattern));
    }
  }

  return dirs;
}

/**
 * Resolves workspace directories to WorkspacePackage objects.
 * Skips directories without a valid package.json.
 */
async function resolvePackages(projectRoot: string, dirs: string[]): Promise<WorkspacePackage[]> {
  const packages: WorkspacePackage[] = [];

  for (const dir of dirs) {
    const pkg = await readPackageJson(dir);
    if (!pkg?.name) continue;

    // Collect all dependency names as potential internal deps
    const allDeps = [
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
    ];

    packages.push({
      name: pkg.name,
      path: dir,
      relativePath: relative(projectRoot, dir),
      internalDeps: allDeps,
    });
  }

  return packages;
}
