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
});
