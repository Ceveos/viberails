import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initCommand } from '../../packages/cli/src/commands/init.js';
import { syncCommand } from '../../packages/cli/src/commands/sync.js';

describe('sync command', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viberails-sync-'));
    const fixtureSrc = path.resolve(__dirname, '../fixtures/nextjs-15');
    fs.cpSync(fixtureSrc, tmpDir, { recursive: true });

    // Initialize first
    await initCommand({ yes: true }, tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('updates config and regenerates context after adding a new file', async () => {
    // Capture initial state
    const configPath = path.join(tmpDir, 'viberails.config.json');
    const contextPath = path.join(tmpDir, '.viberails', 'context.md');
    const _initialConfig = fs.readFileSync(configPath, 'utf-8');
    const _initialContext = fs.readFileSync(contextPath, 'utf-8');

    // Add a new source file to the project
    const newFilePath = path.join(tmpDir, 'src', 'lib', 'new-helper.ts');
    fs.writeFileSync(newFilePath, 'export function newHelper() { return 42; }\n');

    // Run sync
    await syncCommand(tmpDir);

    // Config should still be valid JSON with expected structure
    const updatedConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(updatedConfig.version).toBe(1);
    expect(updatedConfig.stack).toBeDefined();
    expect(updatedConfig.rules).toBeDefined();

    // Context should be regenerated
    const updatedContext = fs.readFileSync(contextPath, 'utf-8');
    expect(updatedContext.length).toBeGreaterThan(0);

    // .cursorrules should be regenerated
    expect(fs.existsSync(path.join(tmpDir, '.cursorrules'))).toBe(true);
  });

  it('preserves user-set config values during merge', async () => {
    const configPath = path.join(tmpDir, 'viberails.config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    // Simulate user editing the config
    config.rules.maxFileLines = 500;
    config.enforcement = 'enforce';
    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

    // Run sync
    await syncCommand(tmpDir);

    // User values should be preserved
    const updated = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(updated.rules.maxFileLines).toBe(500);
    expect(updated.enforcement).toBe('enforce');
  });

  it('fails gracefully when no config exists', async () => {
    const noConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viberails-noconf-'));
    const fixtureSrc = path.resolve(__dirname, '../fixtures/nextjs-15');
    fs.cpSync(fixtureSrc, noConfigDir, { recursive: true });

    await expect(syncCommand(noConfigDir)).rejects.toThrow();

    fs.rmSync(noConfigDir, { recursive: true, force: true });
  });
});
