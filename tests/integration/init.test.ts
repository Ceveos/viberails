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

    // .viberails/context.md — should contain enforced rules, not project description
    const contextPath = path.join(tmpDir, '.viberails', 'context.md');
    expect(fs.existsSync(contextPath)).toBe(true);
    const context = fs.readFileSync(contextPath, 'utf-8');
    expect(context).toContain('viberails enforced rules');
    expect(context).toContain('300 lines');

    // Should NOT create CLAUDE.md or .cursorrules
    expect(fs.existsSync(path.join(tmpDir, 'CLAUDE.md'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, '.cursorrules'))).toBe(false);

    // .gitignore — should include scan-result.json but not .cursorrules
    const gitignorePath = path.join(tmpDir, '.gitignore');
    expect(fs.existsSync(gitignorePath)).toBe(true);
    const gitignore = fs.readFileSync(gitignorePath, 'utf-8');
    expect(gitignore).toContain('.viberails/scan-result.json');
    expect(gitignore).not.toContain('.cursorrules');
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

  it('detects workspace and infers boundaries for monorepo in --yes mode', async () => {
    // Use monorepo-basic fixture instead of nextjs-15
    const monoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viberails-mono-init-'));
    const fixtureSrc = path.resolve(__dirname, '../fixtures/monorepo-basic');
    fs.cpSync(fixtureSrc, monoDir, { recursive: true });

    try {
      await initCommand({ yes: true }, monoDir);

      const configPath = path.join(monoDir, 'viberails.config.json');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

      expect(config.workspace).toBeDefined();
      expect(config.workspace.isMonorepo).toBe(true);
      expect(config.workspace.packages).toEqual(
        expect.arrayContaining([
          expect.stringContaining('core'),
          expect.stringContaining('web'),
          expect.stringContaining('api'),
        ]),
      );

      // In --yes mode, boundaries should be auto-inferred
      expect(config.boundaries).toBeDefined();
      expect(config.boundaries.length).toBeGreaterThan(0);
      expect(config.rules.enforceBoundaries).toBe(true);
    } finally {
      fs.rmSync(monoDir, { recursive: true, force: true });
    }
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
