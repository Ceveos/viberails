import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { syncCommand } from './sync.js';

function writeMinimalConfig(dir: string, overrides: Record<string, unknown> = {}): void {
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

describe('sync command', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viberails-sync-'));
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test-project' }));
    fs.mkdirSync(path.join(tmpDir, '.viberails'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('updates config and regenerates context', async () => {
    writeMinimalConfig(tmpDir);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    try {
      await syncCommand(tmpDir);

      const configContent = JSON.parse(
        fs.readFileSync(path.join(tmpDir, 'viberails.config.json'), 'utf-8'),
      );
      expect(configContent.$schema).toBeDefined();
      expect(fs.existsSync(path.join(tmpDir, '.viberails', 'context.md'))).toBe(true);
    } finally {
      logSpy.mockRestore();
    }
  });

  it('preserves existing config values on sync', async () => {
    writeMinimalConfig(tmpDir, { enforcement: 'enforce' });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    try {
      await syncCommand(tmpDir);

      const configContent = JSON.parse(
        fs.readFileSync(path.join(tmpDir, 'viberails.config.json'), 'utf-8'),
      );
      expect(configContent.enforcement).toBe('enforce');
    } finally {
      logSpy.mockRestore();
    }
  });

  it('throws when no config found', async () => {
    const noConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viberails-sync-noconfig-'));
    fs.writeFileSync(
      path.join(noConfigDir, 'package.json'),
      JSON.stringify({ name: 'test-project' }),
    );

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    try {
      await expect(syncCommand(noConfigDir)).rejects.toThrow();
    } finally {
      logSpy.mockRestore();
      fs.rmSync(noConfigDir, { recursive: true, force: true });
    }
  });
});
