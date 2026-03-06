import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initCommand } from '../../packages/cli/src/commands/init.js';

describe('init command', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viberails-init-'));
    // Copy nextjs-15 fixture
    const fixtureSrc = path.resolve(__dirname, '../fixtures/nextjs-15');
    fs.cpSync(fixtureSrc, tmpDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates all expected files from a nextjs-15 project', async () => {
    await initCommand({ yes: true }, tmpDir);

    // viberails.config.json
    const configPath = path.join(tmpDir, 'viberails.config.json');
    expect(fs.existsSync(configPath)).toBe(true);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(config.version).toBe(1);
    expect(config.stack.framework).toContain('nextjs');
    expect(config.stack.language).toContain('typescript');

    // .viberails/context.md
    const contextPath = path.join(tmpDir, '.viberails', 'context.md');
    expect(fs.existsSync(contextPath)).toBe(true);
    const context = fs.readFileSync(contextPath, 'utf-8');
    expect(context.length).toBeGreaterThan(0);
    expect(context).toContain('Next.js');

    // CLAUDE.md
    const claudeMdPath = path.join(tmpDir, 'CLAUDE.md');
    expect(fs.existsSync(claudeMdPath)).toBe(true);
    const claudeMd = fs.readFileSync(claudeMdPath, 'utf-8');
    expect(claudeMd).toContain('@.viberails/context.md');

    // .cursorrules
    const cursorrullesPath = path.join(tmpDir, '.cursorrules');
    expect(fs.existsSync(cursorrullesPath)).toBe(true);
    const cursorrules = fs.readFileSync(cursorrullesPath, 'utf-8');
    expect(cursorrules.length).toBeGreaterThan(0);

    // .gitignore
    const gitignorePath = path.join(tmpDir, '.gitignore');
    expect(fs.existsSync(gitignorePath)).toBe(true);
    const gitignore = fs.readFileSync(gitignorePath, 'utf-8');
    expect(gitignore).toContain('.viberails/');
    expect(gitignore).toContain('.cursorrules');
  });

  it('does not re-initialize if config already exists', async () => {
    await initCommand({ yes: true }, tmpDir);

    // Capture config content
    const configPath = path.join(tmpDir, 'viberails.config.json');
    const originalConfig = fs.readFileSync(configPath, 'utf-8');

    // Run init again — should detect existing config and return early
    await initCommand({ yes: true }, tmpDir);

    // Config should be unchanged
    const afterConfig = fs.readFileSync(configPath, 'utf-8');
    expect(afterConfig).toBe(originalConfig);
  });

  it('only includes high-confidence conventions in --yes mode', async () => {
    await initCommand({ yes: true }, tmpDir);

    const configPath = path.join(tmpDir, 'viberails.config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    // All convention values should be high confidence or plain strings
    for (const value of Object.values(config.conventions)) {
      if (typeof value === 'object' && value !== null) {
        expect((value as { _confidence: string })._confidence).toBe('high');
      }
    }
  });
});
