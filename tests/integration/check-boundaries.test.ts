import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkCommand } from '../../packages/cli/src/commands/check.js';

describe('check command with boundary enforcement', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viberails-boundary-'));
    const fixtureSrc = path.resolve(__dirname, '../fixtures/monorepo-violations');
    fs.cpSync(fixtureSrc, tmpDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeConfig(overrides: Record<string, unknown> = {}): void {
    const config = {
      version: 1,
      name: 'monorepo-violations',
      enforcement: 'warn',
      stack: { language: 'typescript', packageManager: 'npm' },
      structure: {},
      conventions: {},
      rules: {
        maxFileLines: 0,
        maxFunctionLines: 0,
        requireTests: false,
        enforceNaming: false,
        enforceBoundaries: true,
      },
      ignore: ['**/*.d.ts', 'dist/**', 'node_modules/**'],
      workspace: {
        packages: ['packages/ui', 'packages/api', 'packages/shared'],
        isMonorepo: true,
      },
      boundaries: {
        deny: {
          '@mv/ui': ['@mv/api'],
          '@mv/api': ['@mv/ui'],
        },
      },
      ...overrides,
    };
    fs.writeFileSync(path.join(tmpDir, 'viberails.config.json'), JSON.stringify(config, null, 2));
  }

  it('detects boundary violations when enforceBoundaries is true', async () => {
    writeConfig();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    try {
      const exitCode = await checkCommand({}, tmpDir);
      const output = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');

      // Should detect violations (warn mode = exit 0)
      expect(exitCode).toBe(0);
      expect(output).toContain('boundary-violation');
    } finally {
      logSpy.mockRestore();
    }
  });

  it('returns exit code 1 in enforce mode with violations', async () => {
    writeConfig({ enforcement: 'enforce' });
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

  it('skips boundary check when enforceBoundaries is false', async () => {
    writeConfig({
      rules: {
        maxFileLines: 0,
        maxFunctionLines: 0,
        requireTests: false,
        enforceNaming: false,
        enforceBoundaries: false,
      },
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    try {
      const exitCode = await checkCommand({}, tmpDir);
      const output = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');

      expect(exitCode).toBe(0);
      expect(output).not.toContain('boundary-violation');
      expect(output).not.toContain('Boundary check');
    } finally {
      logSpy.mockRestore();
    }
  });
});
