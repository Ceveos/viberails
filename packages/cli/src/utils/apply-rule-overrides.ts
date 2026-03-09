import type { ViberailsConfig } from '@viberails/types';
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
  config.rules.maxFileLines = overrides.maxFileLines;
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
    const rootPkg = config.packages.find((p) => p.path === '.') ?? config.packages[0];
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
}
