import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configCommand } from './config.js';

describe('config command', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viberails-config-'));
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test-project' }));
    fs.mkdirSync(path.join(tmpDir, '.viberails'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('exits with message when no config exists', async () => {
    const noConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viberails-config-noconfig-'));
    fs.writeFileSync(
      path.join(noConfigDir, 'package.json'),
      JSON.stringify({ name: 'test-project' }),
    );

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    try {
      await configCommand({}, noConfigDir);
      const output = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(output).toContain('No config found');
      expect(output).toContain('viberails');
    } finally {
      logSpy.mockRestore();
      fs.rmSync(noConfigDir, { recursive: true, force: true });
    }
  });

  it('throws when no package.json found', async () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viberails-config-empty-'));

    try {
      await expect(configCommand({}, emptyDir)).rejects.toThrow('No package.json');
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });
});
