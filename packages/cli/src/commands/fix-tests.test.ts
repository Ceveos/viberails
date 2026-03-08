import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { ViberailsConfig } from '@viberails/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateTestStub, writeTestStub } from './fix-tests.js';

let tmpDir: string;

const baseConfig: ViberailsConfig = {
  version: 2,
  name: 'test-project',
  enforcement: 'warn',
  rules: {
    maxFileLines: 300,
    maxTestFileLines: 0,
    requireTests: true,
    enforceNaming: true,
    enforceBoundaries: false,
  },
  ignore: [],
  packages: [
    {
      name: 'test-project',
      path: '.',
      stack: { language: 'typescript', packageManager: 'pnpm', testRunner: 'vitest' },
      structure: { testPattern: '*.test.ts' },
      conventions: {},
    },
  ],
};

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fix-tests-'));
  fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('generateTestStub', () => {
  it('creates a stub record for a source file', () => {
    fs.writeFileSync(path.join(tmpDir, 'src/utils.ts'), 'export const x = 1;');
    const stub = generateTestStub('src/utils.ts', baseConfig, tmpDir);
    expect(stub).not.toBeNull();
    expect(stub?.path).toBe(path.join('src', 'utils.test.ts'));
    expect(stub?.moduleName).toBe('utils');
  });

  it('returns null when test file already exists', () => {
    fs.writeFileSync(path.join(tmpDir, 'src/utils.ts'), '');
    fs.writeFileSync(path.join(tmpDir, 'src/utils.test.ts'), '');
    const stub = generateTestStub('src/utils.ts', baseConfig, tmpDir);
    expect(stub).toBeNull();
  });

  it('returns null when no test pattern configured', () => {
    const config: ViberailsConfig = {
      ...baseConfig,
      packages: [{ ...baseConfig.packages[0], structure: {} }],
    };
    const stub = generateTestStub('src/utils.ts', config, tmpDir);
    expect(stub).toBeNull();
  });
});

describe('writeTestStub', () => {
  it('writes a vitest stub file', () => {
    const stub = {
      path: 'src/utils.test.ts',
      absPath: path.join(tmpDir, 'src/utils.test.ts'),
      moduleName: 'utils',
    };
    writeTestStub(stub, baseConfig);

    const content = fs.readFileSync(stub.absPath, 'utf-8');
    expect(content).toContain("import { describe, it, expect } from 'vitest'");
    expect(content).toContain("describe('utils'");
    expect(content).toContain('it.todo');
  });

  it('writes a jest stub file without import', () => {
    const jestConfig: ViberailsConfig = {
      ...baseConfig,
      packages: [
        {
          ...baseConfig.packages[0],
          stack: { ...baseConfig.packages[0].stack!, testRunner: 'jest' },
        },
      ],
    };
    const stub = {
      path: 'src/utils.test.ts',
      absPath: path.join(tmpDir, 'src/utils.test.ts'),
      moduleName: 'utils',
    };
    writeTestStub(stub, jestConfig);

    const content = fs.readFileSync(stub.absPath, 'utf-8');
    expect(content).not.toContain('import');
    expect(content).toContain("describe('utils'");
  });

  it('is idempotent — does not error on second call', () => {
    const stub = {
      path: 'src/utils.test.ts',
      absPath: path.join(tmpDir, 'src/utils.test.ts'),
      moduleName: 'utils',
    };
    writeTestStub(stub, baseConfig);
    writeTestStub(stub, baseConfig);

    expect(fs.existsSync(stub.absPath)).toBe(true);
  });
});
