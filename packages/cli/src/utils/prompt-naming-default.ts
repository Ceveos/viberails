import * as clack from '@clack/prompts';
import type { DetectedConvention, ScanResult, ViberailsConfig } from '@viberails/types';
import { assertNotCancelled } from './prompt.js';
import { FILE_NAMING_OPTIONS } from './prompt-submenus.js';

interface PackageNamingInfo {
  path: string;
  naming: DetectedConvention;
}

/**
 * Run the pre-emptive naming question if needed during init.
 * Checks whether naming enforcement is on but no convention was detected,
 * then prompts the user to choose a default.
 *
 * Mutates config directly: sets fileNaming on root package or disables enforcement.
 *
 * @returns true if the question was shown, false if skipped
 */
export async function resolveNamingDefault(
  config: ViberailsConfig,
  scanResult: ScanResult,
): Promise<boolean> {
  const rootPkg = config.packages.find((p) => p.path === '.') ?? config.packages[0];
  if (!config.rules.enforceNaming || rootPkg?.conventions?.fileNaming) return false;

  const isMonorepo = config.packages.length > 1;
  const pkgNamingData: PackageNamingInfo[] = isMonorepo
    ? scanResult.packages
        .filter((p) => p.conventions.fileNaming && p.conventions.fileNaming.confidence !== 'low')
        .map((p) => ({
          path: p.relativePath,
          naming: p.conventions.fileNaming as DetectedConvention,
        }))
    : [];

  const chosen = await promptNamingDefault(pkgNamingData, isMonorepo);
  if (chosen === '__skip__') {
    config.rules.enforceNaming = false;
  } else if (rootPkg) {
    rootPkg.conventions = rootPkg.conventions ?? {};
    rootPkg.conventions.fileNaming = chosen;
  }
  return true;
}

/**
 * Pre-emptive naming question shown during init when no overall naming
 * convention was detected. Shows per-package detection context in monorepos.
 *
 * @param pkgNamingData - Per-package naming detection data (monorepo only)
 * @param isMonorepo - Whether the project is a monorepo
 * @returns The chosen naming convention, or '__skip__' to disable enforcement
 */
async function promptNamingDefault(
  pkgNamingData: PackageNamingInfo[],
  isMonorepo: boolean,
): Promise<string> {
  if (isMonorepo && pkgNamingData.length > 0) {
    const lines = pkgNamingData.map(
      (p) => `${p.path}: ${p.naming.value} (${Math.round(p.naming.consistency)}%)`,
    );
    clack.note(lines.join('\n'), 'Per-package file naming detected');
  }

  const message = isMonorepo
    ? 'Which convention should be the default? You can override per-package later.'
    : 'Which file naming convention should be used?';

  // Build options with package counts for monorepos
  const options = FILE_NAMING_OPTIONS.map((opt) => {
    if (isMonorepo && pkgNamingData.length > 0) {
      const count = pkgNamingData.filter((p) => p.naming.value === opt.value).length;
      return {
        value: opt.value,
        label: opt.label,
        hint: count > 0 ? `${count} package${count > 1 ? 's' : ''}` : undefined,
      };
    }
    return { value: opt.value, label: opt.label };
  });

  const selected = await clack.select({
    message,
    options: [...options, { value: '__skip__', label: "Don't enforce naming" }],
  });
  assertNotCancelled(selected);
  return selected;
}
