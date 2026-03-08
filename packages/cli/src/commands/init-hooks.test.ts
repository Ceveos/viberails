import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { detectHookManager, setupClaudeCodeHook, setupPreCommitHook } from './init-hooks.js';

describe('detectHookManager', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viberails-hooks-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns Lefthook when lefthook.yml exists', () => {
    fs.writeFileSync(path.join(tmpDir, 'lefthook.yml'), '');
    expect(detectHookManager(tmpDir)).toBe('Lefthook');
  });

  it('returns Husky when .husky directory exists', () => {
    fs.mkdirSync(path.join(tmpDir, '.husky'));
    expect(detectHookManager(tmpDir)).toBe('Husky');
  });

  it('returns git hook when .git directory exists', () => {
    fs.mkdirSync(path.join(tmpDir, '.git'));
    expect(detectHookManager(tmpDir)).toBe('git hook');
  });

  it('returns undefined when no hook manager or .git found', () => {
    expect(detectHookManager(tmpDir)).toBeUndefined();
  });

  it('prefers Lefthook over Husky', () => {
    fs.writeFileSync(path.join(tmpDir, 'lefthook.yml'), '');
    fs.mkdirSync(path.join(tmpDir, '.husky'));
    expect(detectHookManager(tmpDir)).toBe('Lefthook');
  });
});

describe('setupPreCommitHook', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viberails-hooks-'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('creates .git/hooks/pre-commit when no hook manager exists', () => {
    fs.mkdirSync(path.join(tmpDir, '.git'), { recursive: true });
    setupPreCommitHook(tmpDir);

    const hookPath = path.join(tmpDir, '.git', 'hooks', 'pre-commit');
    expect(fs.existsSync(hookPath)).toBe(true);
    const content = fs.readFileSync(hookPath, 'utf-8');
    expect(content).toContain('#!/bin/sh');
    expect(content).toContain('npx viberails check --staged');
  });

  it('appends to existing .git/hooks/pre-commit without duplicating', () => {
    const hooksDir = path.join(tmpDir, '.git', 'hooks');
    fs.mkdirSync(hooksDir, { recursive: true });
    fs.writeFileSync(path.join(hooksDir, 'pre-commit'), '#!/bin/sh\necho "existing hook"\n');

    setupPreCommitHook(tmpDir);
    setupPreCommitHook(tmpDir); // second call should not duplicate

    const content = fs.readFileSync(path.join(hooksDir, 'pre-commit'), 'utf-8');
    const matches = content.match(/viberails/g);
    expect(matches).toHaveLength(2); // "# viberails check" and "npx viberails check --staged"
  });

  it('detects Lefthook and writes to lefthook.yml', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'lefthook.yml'),
      'pre-push:\n  commands:\n    lint:\n      run: echo lint\n',
    );

    setupPreCommitHook(tmpDir);

    const content = fs.readFileSync(path.join(tmpDir, 'lefthook.yml'), 'utf-8');
    expect(content).toContain('pre-commit:');
    expect(content).toContain('viberails');
    expect(content).toContain('npx viberails check --staged');
  });

  it('appends under existing pre-commit section in lefthook.yml', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'lefthook.yml'),
      'pre-commit:\n  commands:\n    lint:\n      run: echo lint\n',
    );

    setupPreCommitHook(tmpDir);

    const content = fs.readFileSync(path.join(tmpDir, 'lefthook.yml'), 'utf-8');
    expect(content).toContain('viberails');
    expect(content).toContain('npx viberails check --staged');
  });

  it('does not duplicate viberails entry in lefthook.yml', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'lefthook.yml'),
      'pre-commit:\n  commands:\n    viberails:\n      run: npx viberails check --staged\n',
    );

    setupPreCommitHook(tmpDir);

    const content = fs.readFileSync(path.join(tmpDir, 'lefthook.yml'), 'utf-8');
    const matches = content.match(/viberails/g);
    // Only the existing entries, no duplication
    expect(matches?.length).toBeLessThanOrEqual(3);
  });

  it('correctly inserts under pre-commit when it is not the last section', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'lefthook.yml'),
      'pre-commit:\n  commands:\n    lint:\n      run: echo lint\npre-push:\n  commands:\n    deploy:\n      run: echo deploy\n',
    );

    setupPreCommitHook(tmpDir);

    const content = fs.readFileSync(path.join(tmpDir, 'lefthook.yml'), 'utf-8');
    expect(content).toContain('viberails');
    expect(content).toContain('npx viberails check --staged');
    // pre-push section should still be intact
    expect(content).toContain('pre-push');
    expect(content).toContain('deploy');
    // Verify valid YAML structure by checking viberails is under pre-commit
    const { parse } = await import('yaml');
    const doc = parse(content);
    expect(doc['pre-commit'].commands.viberails).toBeDefined();
    expect(doc['pre-push'].commands.deploy).toBeDefined();
  });

  it('detects Husky and writes to .husky/pre-commit', () => {
    fs.mkdirSync(path.join(tmpDir, '.husky'));
    setupPreCommitHook(tmpDir);

    const hookPath = path.join(tmpDir, '.husky', 'pre-commit');
    expect(fs.existsSync(hookPath)).toBe(true);
    const content = fs.readFileSync(hookPath, 'utf-8');
    expect(content).toContain('npx viberails check --staged');
  });

  it('appends to existing .husky/pre-commit without duplicating', () => {
    const huskyDir = path.join(tmpDir, '.husky');
    fs.mkdirSync(huskyDir);
    fs.writeFileSync(path.join(huskyDir, 'pre-commit'), '#!/bin/sh\necho "existing"\n');

    setupPreCommitHook(tmpDir);
    setupPreCommitHook(tmpDir); // second call should not duplicate

    const content = fs.readFileSync(path.join(huskyDir, 'pre-commit'), 'utf-8');
    const matches = content.match(/viberails/g);
    expect(matches).toHaveLength(1);
  });
});

describe('setupClaudeCodeHook', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viberails-claude-'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('creates .claude/settings.json with correct structure', () => {
    setupClaudeCodeHook(tmpDir);

    const settingsPath = path.join(tmpDir, '.claude', 'settings.json');
    expect(fs.existsSync(settingsPath)).toBe(true);

    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    expect(settings.hooks).toBeDefined();
    expect(settings.hooks.PostToolUse).toHaveLength(1);
    expect(settings.hooks.PostToolUse[0].matcher).toBe('Edit|Write');
    expect(settings.hooks.PostToolUse[0].hooks[0].type).toBe('command');
    expect(settings.hooks.PostToolUse[0].hooks[0].command).toContain('viberails check');
  });

  it('is idempotent — does not duplicate hook on second call', () => {
    setupClaudeCodeHook(tmpDir);
    setupClaudeCodeHook(tmpDir);

    const settingsPath = path.join(tmpDir, '.claude', 'settings.json');
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    expect(settings.hooks.PostToolUse).toHaveLength(1);
  });

  it('preserves existing settings in .claude/settings.json', () => {
    const claudeDir = path.join(tmpDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, 'settings.json'),
      JSON.stringify({ permissions: { allow: ['Read'] }, customField: true }, null, 2),
    );

    setupClaudeCodeHook(tmpDir);

    const settings = JSON.parse(fs.readFileSync(path.join(claudeDir, 'settings.json'), 'utf-8'));
    expect(settings.permissions).toEqual({ allow: ['Read'] });
    expect(settings.customField).toBe(true);
    expect(settings.hooks.PostToolUse).toHaveLength(1);
  });

  it('skips hook setup and preserves file when settings.json has invalid JSON', () => {
    const claudeDir = path.join(tmpDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    const invalidContent = '{broken json!!!';
    fs.writeFileSync(path.join(claudeDir, 'settings.json'), invalidContent);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setupClaudeCodeHook(tmpDir);

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('invalid JSON'));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('skipping hook setup'));
    warnSpy.mockRestore();

    // File should be unchanged — not overwritten
    const content = fs.readFileSync(path.join(claudeDir, 'settings.json'), 'utf-8');
    expect(content).toBe(invalidContent);
  });

  it('creates .claude directory if it does not exist', () => {
    expect(fs.existsSync(path.join(tmpDir, '.claude'))).toBe(false);
    setupClaudeCodeHook(tmpDir);
    expect(fs.existsSync(path.join(tmpDir, '.claude'))).toBe(true);
  });

  it('hook command uses --hook flag with local binary preference', () => {
    setupClaudeCodeHook(tmpDir);

    const settingsPath = path.join(tmpDir, '.claude', 'settings.json');
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    const command = settings.hooks.PostToolUse[0].hooks[0].command;
    expect(command).toContain('viberails check --hook');
    expect(command).toContain('./node_modules/.bin/viberails');
    expect(command).toContain('npx viberails check --hook');
  });
});
