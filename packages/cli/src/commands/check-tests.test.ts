import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { ViberailsConfig } from '@viberails/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkMissingTests } from './check-tests.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-tests-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function monorepoConfig(): ViberailsConfig {
  return {
    version: 1,
    name: 'mono',
    rules: {
      maxFileLines: 300,
      maxTestFileLines: 0,
      testCoverage: 80,
      enforceNaming: true,
      enforceBoundaries: false,
      enforceMissingTests: true,
    },
    ignore: [],
    packages: [
      {
        name: 'root',
        path: '.',
        stack: { language: 'typescript', packageManager: 'pnpm' },
        structure: {},
        conventions: {},
      },
      {
        name: '@mono/web',
        path: 'apps/web',
        stack: { language: 'typescript', packageManager: 'pnpm' },
        structure: { srcDir: 'src', testPattern: '*.test.ts' },
        conventions: {},
      },
    ],
  };
}

describe('checkMissingTests', () => {
  it('checks missing tests inside non-root packages', () => {
    const config = monorepoConfig();
    fs.mkdirSync(path.join(tmpDir, 'apps/web/src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'apps/web/src/page.ts'), 'export const page = 1;\n');

    const violations = checkMissingTests(tmpDir, config, 'warn');
    expect(violations).toHaveLength(1);
    expect(violations[0].file).toBe('apps/web/src/page.ts');
    expect(violations[0].rule).toBe('missing-test');
  });

  it('skips missing-test checks for packages with enforceMissingTests set to false', () => {
    const config = monorepoConfig();
    config.packages[1].rules = { enforceMissingTests: false };
    fs.mkdirSync(path.join(tmpDir, 'apps/web/src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'apps/web/src/page.ts'), 'export const page = 1;\n');

    const violations = checkMissingTests(tmpDir, config, 'warn');
    expect(violations).toHaveLength(0);
  });

  it('uses enforceMissingTests independently from testCoverage', () => {
    const config = monorepoConfig();
    config.rules.testCoverage = 0;
    config.rules.enforceMissingTests = true;
    fs.mkdirSync(path.join(tmpDir, 'apps/web/src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'apps/web/src/page.ts'), 'export const page = 1;\n');

    const violations = checkMissingTests(tmpDir, config, 'warn');
    expect(violations).toHaveLength(1);
  });

  it('respects enforceMissingTests: false even when testCoverage > 0', () => {
    const config = monorepoConfig();
    config.rules.testCoverage = 80;
    config.rules.enforceMissingTests = false;
    fs.mkdirSync(path.join(tmpDir, 'apps/web/src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'apps/web/src/page.ts'), 'export const page = 1;\n');

    const violations = checkMissingTests(tmpDir, config, 'warn');
    expect(violations).toHaveLength(0);
  });

  it('preserves dotted file names when deriving expected test file', () => {
    const config = monorepoConfig();
    fs.mkdirSync(path.join(tmpDir, 'apps/web/src'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'apps/web/src/date.util.ts'),
      'export const now = Date.now;\n',
    );

    const violations = checkMissingTests(tmpDir, config, 'warn');
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('`date.util.test.ts`');
  });
});
