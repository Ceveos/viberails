import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkCommand } from './check.js';

function writeConfig(dir: string, overrides: Record<string, unknown> = {}): void {
  const config = {
    version: 1,
    name: 'test-project',
    enforcement: 'warn',
    stack: { language: 'typescript', packageManager: 'pnpm' },
    structure: {},
    conventions: {},
    rules: {
      maxFileLines: 300,
      maxFunctionLines: 50,
      requireTests: false,
      enforceNaming: false,
      enforceBoundaries: false,
    },
    ignore: [],
    ...overrides,
  };
  fs.writeFileSync(path.join(dir, 'viberails.config.json'), JSON.stringify(config, null, 2));
}

describe('check command', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viberails-check-'));
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test-project' }));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns 0 when no violations found', async () => {
    writeConfig(tmpDir, {
      rules: {
        maxFileLines: 999,
        maxFunctionLines: 50,
        requireTests: false,
        enforceNaming: false,
        enforceBoundaries: false,
      },
    });
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'hello.ts'), 'export const hello = 1;\n');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const exitCode = await checkCommand({}, tmpDir);
      expect(exitCode).toBe(0);
    } finally {
      logSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it('reports file size violations', async () => {
    writeConfig(tmpDir, {
      rules: {
        maxFileLines: 300,
        maxFunctionLines: 50,
        requireTests: false,
        enforceNaming: false,
        enforceBoundaries: false,
      },
    });
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    const bigFile = Array.from({ length: 400 }, (_, i) => `const line${i} = ${i};`).join('\n');
    fs.writeFileSync(path.join(tmpDir, 'src', 'big-file.ts'), bigFile);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await checkCommand({}, tmpDir);
      const output = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(output).toContain('file-size');
    } finally {
      logSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it('returns 1 in enforce mode with violations', async () => {
    writeConfig(tmpDir, {
      enforcement: 'enforce',
      rules: {
        maxFileLines: 300,
        maxFunctionLines: 50,
        requireTests: false,
        enforceNaming: false,
        enforceBoundaries: false,
      },
    });
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    const bigFile = Array.from({ length: 400 }, (_, i) => `const line${i} = ${i};`).join('\n');
    fs.writeFileSync(path.join(tmpDir, 'src', 'big-file.ts'), bigFile);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const exitCode = await checkCommand({}, tmpDir);
      expect(exitCode).toBe(1);
    } finally {
      logSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it('returns 0 with no files to check when staged', async () => {
    writeConfig(tmpDir);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const exitCode = await checkCommand({ staged: true }, tmpDir);
      expect(exitCode).toBe(0);
    } finally {
      logSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});
