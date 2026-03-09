import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initCommand } from './init.js';

describe('init command', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viberails-init-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates config and context files', async () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test-project' }));
    fs.writeFileSync(path.join(tmpDir, 'pnpm-lock.yaml'), '');
    fs.mkdirSync(path.join(tmpDir, '.git'));

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    try {
      await initCommand({ yes: true }, tmpDir);

      expect(fs.existsSync(path.join(tmpDir, 'viberails.config.json'))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, '.viberails', 'context.md'))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, '.viberails', 'scan-result.json'))).toBe(true);
    } finally {
      logSpy.mockRestore();
    }
  });

  it('aborts if config already exists and suggests config command', async () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test-project' }));
    fs.writeFileSync(path.join(tmpDir, 'viberails.config.json'), '{}');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    try {
      await initCommand({ yes: true }, tmpDir);
      const output = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(output).toContain('already initialized');
      expect(output).toContain('viberails config');
      expect(output).toContain('viberails sync');
      expect(output).toContain('viberails init --force');
    } finally {
      logSpy.mockRestore();
    }
  });

  it('overwrites existing config with --force --yes', async () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test-project' }));
    fs.writeFileSync(path.join(tmpDir, 'pnpm-lock.yaml'), '');
    fs.mkdirSync(path.join(tmpDir, '.git'));
    fs.writeFileSync(path.join(tmpDir, 'viberails.config.json'), '{}');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    try {
      await initCommand({ yes: true, force: true }, tmpDir);

      const config = JSON.parse(
        fs.readFileSync(path.join(tmpDir, 'viberails.config.json'), 'utf-8'),
      );
      expect(config.version).toBe(1);
      expect(config.rules).toBeDefined();
    } finally {
      logSpy.mockRestore();
    }
  });

  it('throws when no package.json found', async () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viberails-init-empty-'));

    try {
      await expect(initCommand({ yes: true }, emptyDir)).rejects.toThrow('No package.json');
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });
});
