import {
  type CodebaseStatistics,
  confidenceFromConsistency,
  type DetectedConvention,
  type DetectedStack,
  type DetectedStructure,
  type PackageScanResult,
} from '@viberails/types';

/** Framework priority order — higher-priority frameworks become the primary. */
const FRAMEWORK_PRIORITY = [
  'nextjs',
  'sveltekit',
  'astro',
  'expo',
  'react-native',
  'svelte',
  'vue',
  'react',
];

/**
 * Combines per-package stacks into a single aggregate stack.
 *
 * TypeScript wins over JavaScript if any package uses it.
 * The highest-priority framework becomes the primary; others go into libraries.
 */
export function aggregateStacks(packages: PackageScanResult[]): DetectedStack {
  if (packages.length === 1) return packages[0].stack;

  const language = packages.some((p) => p.stack.language.name === 'typescript')
    ? packages.find((p) => p.stack.language.name === 'typescript')!.stack.language
    : packages[0].stack.language;

  const packageManager = packages[0].stack.packageManager;

  const frameworkPackages = packages.filter((p) => p.stack.framework);
  let framework: (typeof packages)[0]['stack']['framework'];
  if (frameworkPackages.length > 0) {
    frameworkPackages.sort((a, b) => {
      const aIdx = FRAMEWORK_PRIORITY.indexOf(a.stack.framework!.name);
      const bIdx = FRAMEWORK_PRIORITY.indexOf(b.stack.framework!.name);
      return (aIdx === -1 ? Infinity : aIdx) - (bIdx === -1 ? Infinity : bIdx);
    });
    framework = frameworkPackages[0].stack.framework;
  }

  const libraryMap = new Map<string, { name: string; version?: string }>();

  for (const pkg of packages) {
    if (pkg.stack.framework && pkg.stack.framework.name !== framework?.name) {
      libraryMap.set(pkg.stack.framework.name, pkg.stack.framework);
    }
    for (const lib of pkg.stack.libraries) {
      if (!libraryMap.has(lib.name)) {
        libraryMap.set(lib.name, lib);
      }
    }
  }

  const styling = packages.find((p) => p.stack.styling)?.stack.styling;
  const backend = packages.find((p) => p.stack.backend)?.stack.backend;
  const linter = packages.find((p) => p.stack.linter)?.stack.linter;
  const testRunner = packages.find((p) => p.stack.testRunner)?.stack.testRunner;

  return {
    language,
    packageManager,
    framework,
    libraries: [...libraryMap.values()],
    styling,
    backend,
    linter,
    testRunner,
  };
}

/**
 * Combines per-package structures into a single aggregate structure.
 *
 * Directory paths are prefixed with the package's relativePath.
 */
export function aggregateStructures(packages: PackageScanResult[]): DetectedStructure {
  if (packages.length === 1) return packages[0].structure;

  const srcDir = packages.some((p) => p.structure.srcDir) ? 'src' : undefined;

  const directories = packages.flatMap((pkg) =>
    pkg.structure.directories.map((dir) => ({
      ...dir,
      path: pkg.relativePath ? `${pkg.relativePath}/${dir.path}` : dir.path,
    })),
  );

  const testPatterns = packages
    .map((p) => p.structure.testPattern)
    .filter((t): t is DetectedConvention<string> => t !== undefined);

  let testPattern: DetectedConvention<string> | undefined;
  if (testPatterns.length > 0) {
    const counts = new Map<string, { count: number; pattern: DetectedConvention<string> }>();
    for (const tp of testPatterns) {
      const existing = counts.get(tp.value);
      if (existing) {
        existing.count++;
      } else {
        counts.set(tp.value, { count: 1, pattern: tp });
      }
    }
    let best = { count: 0, pattern: testPatterns[0] };
    for (const entry of counts.values()) {
      if (entry.count > best.count) best = entry;
    }
    testPattern = best.pattern;
  }

  return { srcDir, directories, testPattern };
}

/**
 * Combines per-package conventions into aggregate conventions.
 *
 * When all packages agree on a convention, reports it with averaged consistency.
 * When packages disagree, scales consistency by agreement ratio.
 * Omits conventions present in fewer than half of packages.
 */
export function aggregateConventions(
  packages: PackageScanResult[],
): Record<string, DetectedConvention> {
  if (packages.length === 1) return packages[0].conventions;

  const allKeys = new Set<string>();
  for (const pkg of packages) {
    for (const key of Object.keys(pkg.conventions)) {
      allKeys.add(key);
    }
  }

  const result: Record<string, DetectedConvention> = {};

  for (const key of allKeys) {
    const entries = packages
      .map((p) => p.conventions[key])
      .filter((c): c is DetectedConvention => c !== undefined);

    if (entries.length < packages.length / 2) continue;

    const valueCounts = new Map<
      string,
      { count: number; totalConsistency: number; totalSamples: number }
    >();
    for (const entry of entries) {
      const existing = valueCounts.get(entry.value);
      if (existing) {
        existing.count++;
        existing.totalConsistency += entry.consistency;
        existing.totalSamples += entry.sampleSize;
      } else {
        valueCounts.set(entry.value, {
          count: 1,
          totalConsistency: entry.consistency,
          totalSamples: entry.sampleSize,
        });
      }
    }

    let majorityValue = '';
    let majorityData = { count: 0, totalConsistency: 0, totalSamples: 0 };
    for (const [value, data] of valueCounts) {
      if (data.count > majorityData.count) {
        majorityValue = value;
        majorityData = data;
      }
    }

    const agreement = majorityData.count / entries.length;
    const avgConsistency = majorityData.totalConsistency / majorityData.count;
    const consistency = Math.round(avgConsistency * agreement);

    result[key] = {
      value: majorityValue,
      confidence: confidenceFromConsistency(consistency),
      sampleSize: majorityData.totalSamples,
      consistency,
    };
  }

  return result;
}

/**
 * Combines per-package statistics into aggregate statistics.
 *
 * Sums totals, recomputes averages, merges largest files with path prefixing.
 */
export function aggregateStatistics(packages: PackageScanResult[]): CodebaseStatistics {
  if (packages.length === 1) return packages[0].statistics;

  const totalFiles = packages.reduce((sum, p) => sum + p.statistics.totalFiles, 0);
  const totalLines = packages.reduce((sum, p) => sum + p.statistics.totalLines, 0);
  const averageFileLines = totalFiles > 0 ? Math.round(totalLines / totalFiles) : 0;

  const largestFiles = packages
    .flatMap((pkg) =>
      pkg.statistics.largestFiles.map((f) => ({
        path: pkg.relativePath ? `${pkg.relativePath}/${f.path}` : f.path,
        lines: f.lines,
      })),
    )
    .sort((a, b) => b.lines - a.lines)
    .slice(0, 5);

  const filesByExtension: Record<string, number> = {};
  for (const pkg of packages) {
    for (const [ext, count] of Object.entries(pkg.statistics.filesByExtension)) {
      filesByExtension[ext] = (filesByExtension[ext] ?? 0) + count;
    }
  }

  return { totalFiles, totalLines, averageFileLines, largestFiles, filesByExtension };
}
