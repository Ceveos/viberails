import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixCommand } from './fix.js';

function writeConfig(dir: string, overrides: Record<string, unknown> = {}): void {
  const config = {
    version: 1,
    name: 'test-project',
    rules: {
      maxFileLines: 300,
      maxTestFileLines: 0,
      testCoverage: 0,
      enforceNaming: true,
      enforceBoundaries: false,
      enforceMissingTests: true,
    },
    ignore: [],
    packages: [
      {
        name: 'test-project',
        path: '.',
        stack: { language: 'typescript', packageManager: 'pnpm' },
        structure: {},
        conventions: { fileNaming: 'kebab-case' },
      },
    ],
    ...overrides,
  };
  fs.writeFileSync(path.join(dir, 'viberails.config.json'), JSON.stringify(config, null, 2));
}

describe('fix command', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viberails-fix-'));
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test-project' }));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reports no violations when project is clean', async () => {
    writeConfig(tmpDir);
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'hello-world.ts'), 'export const x = 1;\n');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const exitCode = await fixCommand({ yes: true }, tmpDir);
      expect(exitCode).toBe(0);
      const output = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(output).toContain('No fixable violations');
    } finally {
      logSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it('renames files in dry-run mode without modifying filesystem', async () => {
    writeConfig(tmpDir);
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'MyComponent.ts'), 'export const x = 1;\n');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const exitCode = await fixCommand({ dryRun: true }, tmpDir);
      expect(exitCode).toBe(0);
      const output = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(output).toContain('my-component');
      expect(fs.existsSync(path.join(tmpDir, 'src', 'MyComponent.ts'))).toBe(true);
    } finally {
      logSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it('returns 1 when no config found', async () => {
    const noConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viberails-fix-noconfig-'));
    fs.writeFileSync(
      path.join(noConfigDir, 'package.json'),
      JSON.stringify({ name: 'test-project' }),
    );

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const exitCode = await fixCommand({ yes: true }, noConfigDir);
      expect(exitCode).toBe(1);
    } finally {
      logSpy.mockRestore();
      errorSpy.mockRestore();
      fs.rmSync(noConfigDir, { recursive: true, force: true });
    }
  });

  it('generates missing test stubs when test coverage is enabled', async () => {
    writeConfig(tmpDir, {
      rules: {
        maxFileLines: 300,
        maxTestFileLines: 0,
        testCoverage: 80,
        enforceNaming: false,
        enforceBoundaries: false,
        enforceMissingTests: true,
      },
      packages: [
        {
          name: 'test-project',
          path: '.',
          stack: { language: 'typescript', packageManager: 'pnpm', testRunner: 'vitest' },
          structure: { srcDir: 'src', testPattern: '*.test.ts' },
          conventions: {},
        },
      ],
    });
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'src', 'math.ts'),
      'export const add = (a:number,b:number)=>a+b;\n',
    );

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const exitCode = await fixCommand({ yes: true }, tmpDir);
      expect(exitCode).toBe(0);
      expect(fs.existsSync(path.join(tmpDir, 'src', 'math.test.ts'))).toBe(true);
    } finally {
      logSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});
