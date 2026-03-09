import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Check if turbo.json defines a specific task.
 * Supports both Turbo v2 ("tasks") and v1 ("pipeline") schemas.
 */
export function hasTurboTask(projectRoot: string, taskName: string): boolean {
  const turboPath = path.join(projectRoot, 'turbo.json');
  if (!fs.existsSync(turboPath)) return false;
  try {
    const turbo = JSON.parse(fs.readFileSync(turboPath, 'utf-8'));
    const tasks = turbo.tasks ?? turbo.pipeline ?? {};
    return taskName in tasks;
  } catch {
    return false;
  }
}

export interface TypecheckResolution {
  /** The command to run, or undefined if no safe command can be inferred. */
  command?: string;
  /** Human-readable label for CLI output. */
  label?: string;
  /** Reason typecheck was skipped (set when command is undefined). */
  reason?: string;
}

/**
 * Resolve the best typecheck command for a project.
 *
 * Decision tree:
 * 1. Turbo defines a `typecheck` task → `npx turbo typecheck`
 * 2. Root package.json has a `typecheck` script → `{pm} run typecheck`
 * 3. Root tsconfig.json exists → `npx tsc --noEmit`
 * 4. Otherwise → skip with reason
 */
export function resolveTypecheckCommand(
  projectRoot: string,
  packageManager?: string,
): TypecheckResolution {
  // 1. Turbo typecheck task
  if (hasTurboTask(projectRoot, 'typecheck')) {
    return { command: 'npx turbo typecheck', label: 'turbo typecheck' };
  }

  // 2. Root package.json typecheck script
  const pkgJsonPath = path.join(projectRoot, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
      if (pkg.scripts?.typecheck) {
        const pm = packageManager ?? 'npm';
        return { command: `${pm} run typecheck`, label: `${pm} run typecheck` };
      }
    } catch {
      // ignore parse errors
    }
  }

  // 3. Root tsconfig.json exists
  if (fs.existsSync(path.join(projectRoot, 'tsconfig.json'))) {
    return { command: 'npx tsc --noEmit', label: 'tsc --noEmit' };
  }

  // 4. No safe command
  return {
    reason: 'no root tsconfig.json, no typecheck script, and no turbo typecheck task found',
  };
}
