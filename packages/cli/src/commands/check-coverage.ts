import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  CheckViolation,
  ConfigCoverage,
  ConfigRules,
  PackageConfig,
  ViberailsConfig,
} from '@viberails/types';

const DEFAULT_SUMMARY_PATH = 'coverage/coverage-summary.json';

interface ResolvedPackageCoverage {
  pkg: PackageConfig;
  rules: ConfigRules;
  coverage: ConfigCoverage;
}

interface CoverageSummary {
  total?: {
    lines?: {
      pct?: number;
    };
  };
}

function packageRoot(projectRoot: string, pkg: PackageConfig): string {
  return pkg.path === '.' ? projectRoot : path.join(projectRoot, pkg.path);
}

function resolveForPackage(config: ViberailsConfig, pkg: PackageConfig): ResolvedPackageCoverage {
  return {
    pkg,
    rules: { ...config.rules, ...pkg.rules },
    coverage: {
      ...(config.defaults?.coverage ?? {}),
      ...(pkg.coverage ?? {}),
    },
  };
}

function resolveCoveragePackages(
  projectRoot: string,
  config: ViberailsConfig,
  filesToCheck: string[],
  staged: boolean,
): ResolvedPackageCoverage[] {
  if (!staged) {
    return config.packages.map((pkg) => resolveForPackage(config, pkg));
  }

  const matched = new Map<string, ResolvedPackageCoverage>();
  for (const raw of filesToCheck) {
    const relPath = path.isAbsolute(raw) ? path.relative(projectRoot, raw) : raw;
    const sorted = [...config.packages]
      .filter((pkg) => pkg.path !== '.')
      .sort((a, b) => b.path.length - a.path.length);
    const pkg =
      sorted.find(
        (candidate) => relPath.startsWith(`${candidate.path}/`) || relPath === candidate.path,
      ) ??
      config.packages.find((candidate) => candidate.path === '.') ??
      config.packages[0];
    matched.set(pkg.path, resolveForPackage(config, pkg));
  }
  return [...matched.values()];
}

function readCoveragePercentage(summaryPath: string): number | undefined {
  try {
    const parsed = JSON.parse(fs.readFileSync(summaryPath, 'utf-8')) as CoverageSummary;
    const pct = parsed.total?.lines?.pct;
    return typeof pct === 'number' ? pct : undefined;
  } catch {
    return undefined;
  }
}

function runCoverageCommand(pkgRoot: string, command: string): { ok: boolean; detail?: string } {
  const result = spawnSync(command, {
    cwd: pkgRoot,
    shell: true,
    encoding: 'utf-8',
    stdio: 'pipe',
  });
  if (result.status === 0) return { ok: true };
  const stderr = result.stderr?.trim();
  const stdout = result.stdout?.trim();
  const detail = stderr || stdout || `exit code ${result.status ?? 1}`;
  return { ok: false, detail };
}

function violationFilePath(projectRoot: string, pkgRoot: string, summaryPath: string): string {
  return path.relative(projectRoot, path.join(pkgRoot, summaryPath));
}

function pushViolation(
  violations: CheckViolation[],
  file: string,
  message: string,
  severity: 'warn' | 'error',
): void {
  violations.push({
    file,
    rule: 'test-coverage',
    message,
    severity,
  });
}

export function checkCoverage(
  projectRoot: string,
  config: ViberailsConfig,
  filesToCheck: string[],
  options: { staged?: boolean; enforce?: boolean },
): CheckViolation[] {
  const severity: 'warn' | 'error' = options.enforce ? 'error' : 'warn';
  const targets = resolveCoveragePackages(
    projectRoot,
    config,
    filesToCheck,
    options.staged === true,
  );
  const violations: CheckViolation[] = [];

  for (const target of targets) {
    if (target.rules.testCoverage <= 0) continue;

    const pkgRoot = packageRoot(projectRoot, target.pkg);
    const summaryPath = target.coverage.summaryPath ?? DEFAULT_SUMMARY_PATH;
    const summaryAbs = path.join(pkgRoot, summaryPath);
    const summaryRel = violationFilePath(projectRoot, pkgRoot, summaryPath);

    let pct = readCoveragePercentage(summaryAbs);

    if (pct === undefined && !options.staged) {
      const command = target.coverage.command;
      if (!command) {
        const pkgLabel = target.pkg.path === '.' ? 'root package' : target.pkg.path;
        pushViolation(
          violations,
          summaryRel,
          `No coverage summary found for "${pkgLabel}". Run your test suite with coverage enabled, or set defaults.coverage.command in viberails.config.json.`,
          severity,
        );
        continue;
      }

      const run = runCoverageCommand(pkgRoot, command);
      if (!run.ok) {
        pushViolation(
          violations,
          summaryRel,
          `Failed to run coverage command: ${run.detail}.`,
          severity,
        );
        continue;
      }

      pct = readCoveragePercentage(summaryAbs);
    }

    if (pct === undefined) {
      pushViolation(
        violations,
        summaryRel,
        `Coverage summary not found or invalid at \`${summaryPath}\`.`,
        severity,
      );
      continue;
    }

    if (pct < target.rules.testCoverage) {
      pushViolation(
        violations,
        summaryRel,
        `Line coverage ${pct.toFixed(1)}% is below required ${target.rules.testCoverage}%.`,
        severity,
      );
    }
  }

  return violations;
}
