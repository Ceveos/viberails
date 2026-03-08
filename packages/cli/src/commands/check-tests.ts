import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CheckViolation, PackageConfig, ViberailsConfig } from '@viberails/types';
import { collectSourceFiles } from './check-files.js';

const SOURCE_EXTS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.vue',
  '.svelte',
  '.astro',
]);

/** Check for source files without corresponding test files. */
export function checkMissingTests(
  projectRoot: string,
  config: ViberailsConfig,
  severity: 'error' | 'warn',
): CheckViolation[] {
  const violations: CheckViolation[] = [];
  for (const pkg of config.packages) {
    const effectiveRules = { ...config.rules, ...pkg.rules };
    if (effectiveRules.testCoverage <= 0) continue;

    const testPattern = pkg.structure?.testPattern;
    const srcDir = pkg.structure?.srcDir;
    if (!testPattern || !srcDir) continue;

    const packageRoot = pkg.path === '.' ? projectRoot : path.join(projectRoot, pkg.path);
    const srcPath = path.join(packageRoot, srcDir);
    if (!fs.existsSync(srcPath)) continue;

    const testSuffix = testPattern.replace('*', '');
    const sourceFiles = collectSourceFiles(srcPath, projectRoot);

    for (const relFile of sourceFiles) {
      const basename = path.basename(relFile);

      // Skip test files, index files, type definition files
      if (
        basename.includes('.test.') ||
        basename.includes('.spec.') ||
        basename.startsWith('index.') ||
        basename.endsWith('.d.ts')
      ) {
        continue;
      }

      const ext = path.extname(basename);
      if (!SOURCE_EXTS.has(ext)) continue;

      const stem = basename.slice(0, basename.indexOf('.'));
      const expectedTestFile = `${stem}${testSuffix}`;

      // Look for the test file next to the source or in the package tests directory
      const dir = path.dirname(path.join(projectRoot, relFile));
      const colocatedTest = path.join(dir, expectedTestFile);
      const testsDir = pkg.structure?.tests;
      const dedicatedTest = testsDir ? path.join(packageRoot, testsDir, expectedTestFile) : null;

      const hasTest =
        fs.existsSync(colocatedTest) || (dedicatedTest !== null && fs.existsSync(dedicatedTest));

      if (!hasTest) {
        violations.push({
          file: relFile,
          rule: 'missing-test',
          message: `No test file found. Expected \`${expectedTestFile}\`.`,
          severity,
        });
      }
    }
  }

  return violations;
}

export function resolvePackageForFile(
  sourceRelPath: string,
  config: ViberailsConfig,
): PackageConfig | undefined {
  const sorted = [...config.packages]
    .filter((p) => p.path !== '.')
    .sort((a, b) => b.path.length - a.path.length);
  for (const pkg of sorted) {
    if (sourceRelPath.startsWith(`${pkg.path}/`) || sourceRelPath === pkg.path) {
      return pkg;
    }
  }
  return config.packages.find((p) => p.path === '.') ?? config.packages[0];
}
