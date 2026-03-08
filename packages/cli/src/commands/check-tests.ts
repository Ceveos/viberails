import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CheckViolation, ViberailsConfig } from '@viberails/types';
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
  const root = config.packages.find((p) => p.path === '.') ?? config.packages[0];
  const testPattern = root.structure?.testPattern;
  if (!testPattern) return violations;

  const srcDir = root.structure?.srcDir;
  if (!srcDir) return violations;

  const srcPath = path.join(projectRoot, srcDir);
  if (!fs.existsSync(srcPath)) return violations;

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

    // Look for the test file next to the source or in the tests directory
    const dir = path.dirname(path.join(projectRoot, relFile));
    const colocatedTest = path.join(dir, expectedTestFile);
    const testsDir = root.structure?.tests;
    const dedicatedTest = testsDir ? path.join(projectRoot, testsDir, expectedTestFile) : null;

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

  return violations;
}
