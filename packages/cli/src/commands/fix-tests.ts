import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ViberailsConfig } from '@viberails/types';

export interface TestStubRecord {
  path: string;
  absPath: string;
  moduleName: string;
}

/**
 * Generate a test stub record for a source file that is missing tests.
 * Returns null if the test file already exists.
 */
export function generateTestStub(
  sourceRelPath: string,
  config: ViberailsConfig,
  projectRoot: string,
): TestStubRecord | null {
  const { testPattern } = config.structure;
  if (!testPattern) return null;

  const basename = path.basename(sourceRelPath);
  const stem = basename.slice(0, basename.indexOf('.'));
  const testSuffix = testPattern.replace('*', '');
  const testFilename = `${stem}${testSuffix}`;

  const dir = path.dirname(path.join(projectRoot, sourceRelPath));
  const testAbsPath = path.join(dir, testFilename);

  if (fs.existsSync(testAbsPath)) return null;

  return {
    path: path.relative(projectRoot, testAbsPath),
    absPath: testAbsPath,
    moduleName: stem,
  };
}

/**
 * Write a test stub file to disk.
 */
export function writeTestStub(stub: TestStubRecord, config: ViberailsConfig): void {
  const runner = config.stack.testRunner === 'jest' ? 'jest' : 'vitest';
  const importLine =
    runner === 'jest'
      ? '' // jest globals are available without import
      : "import { describe, it, expect } from 'vitest';\n\n";

  const content = `${importLine}describe('${stub.moduleName}', () => {\n  it.todo('add tests');\n});\n`;

  fs.mkdirSync(path.dirname(stub.absPath), { recursive: true });
  fs.writeFileSync(stub.absPath, content);
}
