import type { ViberailsConfig } from '@viberails/types';
import { getRootPackage } from './get-root-package.js';
import type { RuleOverrides } from './prompt-rules.js';

/**
 * Apply user-chosen rule overrides to a ViberailsConfig in-place.
 * Shared between `init` (interactive customize flow) and `config` command.
 *
 * @param config - The config to mutate
 * @param overrides - The rule overrides from promptRuleMenu
 */
export function applyRuleOverrides(config: ViberailsConfig, overrides: RuleOverrides): void {
  if (overrides.packageOverrides) config.packages = overrides.packageOverrides;
  const rootPkg = getRootPackage(config.packages);

  config.rules.maxFileLines = overrides.maxFileLines;
  config.rules.maxTestFileLines = overrides.maxTestFileLines;
  config.rules.testCoverage = overrides.testCoverage;
  config.rules.enforceMissingTests = overrides.enforceMissingTests;
  config.rules.enforceNaming = overrides.enforceNaming;

  for (const pkg of config.packages) {
    pkg.coverage = pkg.coverage ?? {};
    if (pkg.coverage.summaryPath === undefined) {
      pkg.coverage.summaryPath = overrides.coverageSummaryPath;
    }
    if (pkg.coverage.command === undefined && overrides.coverageCommand) {
      pkg.coverage.command = overrides.coverageCommand;
    }
  }

  if (overrides.fileNamingValue) {
    const oldNaming = rootPkg.conventions?.fileNaming;
    rootPkg.conventions = rootPkg.conventions ?? {};
    rootPkg.conventions.fileNaming = overrides.fileNamingValue;
    if (oldNaming && oldNaming !== overrides.fileNamingValue) {
      for (const pkg of config.packages) {
        if (pkg.conventions?.fileNaming === oldNaming) {
          pkg.conventions.fileNaming = overrides.fileNamingValue;
        }
      }
    }
  }

  // Apply convention overrides to root package
  if (rootPkg) {
    rootPkg.conventions = rootPkg.conventions ?? {};
    if (overrides.componentNaming !== undefined) {
      rootPkg.conventions.componentNaming = overrides.componentNaming || undefined;
    }
    if (overrides.hookNaming !== undefined) {
      rootPkg.conventions.hookNaming = overrides.hookNaming || undefined;
    }
    if (overrides.importAlias !== undefined) {
      rootPkg.conventions.importAlias = overrides.importAlias || undefined;
    }
  }
}
