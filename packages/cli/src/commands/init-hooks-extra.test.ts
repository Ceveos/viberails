import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addPreCommitStep,
  hasTurboTask,
  setupLintHook,
  setupTypecheckHook,
} from './init-hooks-extra.js';

describe('addPreCommitStep', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viberails-step-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('adds a command to lefthook.yml', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'lefthook.yml'),
      'pre-commit:\n  commands:\n    lint:\n      run: echo lint\n',
    );
    const target = addPreCommitStep(tmpDir, 'typecheck', 'npx tsc --noEmit', 'tsc');
    expect(target).toBe('lefthook.yml');
    const content = fs.readFileSync(path.join(tmpDir, 'lefthook.yml'), 'utf-8');
    expect(content).toContain('typecheck');
    expect(content).toContain('npx tsc --noEmit');
  });

  it('skips lefthook if marker already present', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'lefthook.yml'),
      'pre-commit:\n  commands:\n    typecheck:\n      run: npx tsc --noEmit\n',
    );
    const target = addPreCommitStep(tmpDir, 'typecheck', 'npx tsc --noEmit', 'tsc');
    expect(target).toBeUndefined();
  });

  it('appends to existing husky pre-commit', () => {
    const huskyDir = path.join(tmpDir, '.husky');
    fs.mkdirSync(huskyDir);
    fs.writeFileSync(path.join(huskyDir, 'pre-commit'), '#!/bin/sh\necho "existing"\n');
    const target = addPreCommitStep(tmpDir, 'typecheck', 'npx tsc --noEmit', 'tsc');
    expect(target).toBe('.husky/pre-commit');
    const content = fs.readFileSync(path.join(huskyDir, 'pre-commit'), 'utf-8');
    expect(content).toContain('npx tsc --noEmit');
    expect(content).toContain('existing');
  });

  it('creates husky pre-commit if it does not exist', () => {
    fs.mkdirSync(path.join(tmpDir, '.husky'));
    const target = addPreCommitStep(tmpDir, 'typecheck', 'npx tsc --noEmit', 'tsc');
    expect(target).toBe('.husky/pre-commit');
  });

  it('appends to existing .git/hooks/pre-commit', () => {
    const hooksDir = path.join(tmpDir, '.git', 'hooks');
    fs.mkdirSync(hooksDir, { recursive: true });
    fs.writeFileSync(path.join(hooksDir, 'pre-commit'), '#!/bin/sh\necho "existing"\n');
    const target = addPreCommitStep(tmpDir, 'typecheck', 'npx tsc --noEmit', 'tsc');
    expect(target).toBe('.git/hooks/pre-commit');
    const content = fs.readFileSync(path.join(hooksDir, 'pre-commit'), 'utf-8');
    expect(content).toContain('npx tsc --noEmit');
  });

  it('creates .git/hooks/pre-commit if it does not exist', () => {
    fs.mkdirSync(path.join(tmpDir, '.git'), { recursive: true });
    const target = addPreCommitStep(tmpDir, 'typecheck', 'npx tsc --noEmit', 'tsc');
    expect(target).toBe('.git/hooks/pre-commit');
  });

  it('returns undefined when no hook manager or .git found', () => {
    const target = addPreCommitStep(tmpDir, 'typecheck', 'npx tsc --noEmit', 'tsc');
    expect(target).toBeUndefined();
  });
});

describe('hasTurboTask', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viberails-turbo-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns false when turbo.json does not exist', () => {
    expect(hasTurboTask(tmpDir, 'typecheck')).toBe(false);
  });

  it('returns true when turbo v2 tasks contains the task', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'turbo.json'),
      JSON.stringify({ tasks: { build: {}, typecheck: {} } }),
    );
    expect(hasTurboTask(tmpDir, 'typecheck')).toBe(true);
  });

  it('returns false when turbo v2 tasks does not contain the task', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'turbo.json'),
      JSON.stringify({ tasks: { build: {}, test: {} } }),
    );
    expect(hasTurboTask(tmpDir, 'typecheck')).toBe(false);
  });

  it('returns true when turbo v1 pipeline contains the task', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'turbo.json'),
      JSON.stringify({ pipeline: { typecheck: {} } }),
    );
    expect(hasTurboTask(tmpDir, 'typecheck')).toBe(true);
  });

  it('returns false for invalid JSON', () => {
    fs.writeFileSync(path.join(tmpDir, 'turbo.json'), 'not json');
    expect(hasTurboTask(tmpDir, 'typecheck')).toBe(false);
  });
});

describe('setupTypecheckHook', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viberails-tc-'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('adds tsc --noEmit when no turbo.json exists', () => {
    fs.mkdirSync(path.join(tmpDir, '.git'));
    const target = setupTypecheckHook(tmpDir);
    expect(target).toBe('.git/hooks/pre-commit');
    const content = fs.readFileSync(path.join(tmpDir, '.git', 'hooks', 'pre-commit'), 'utf-8');
    expect(content).toContain('npx tsc --noEmit');
  });

  it('adds tsc --noEmit when turbo.json has no typecheck task', () => {
    fs.mkdirSync(path.join(tmpDir, '.git'));
    fs.writeFileSync(
      path.join(tmpDir, 'turbo.json'),
      JSON.stringify({ tasks: { build: {}, test: {} } }),
    );
    const target = setupTypecheckHook(tmpDir);
    expect(target).toBe('.git/hooks/pre-commit');
    const content = fs.readFileSync(path.join(tmpDir, '.git', 'hooks', 'pre-commit'), 'utf-8');
    expect(content).toContain('npx tsc --noEmit');
    expect(content).not.toContain('turbo');
  });

  it('adds turbo typecheck when turbo.json defines typecheck task', () => {
    fs.mkdirSync(path.join(tmpDir, '.git'));
    fs.writeFileSync(
      path.join(tmpDir, 'turbo.json'),
      JSON.stringify({ tasks: { build: {}, typecheck: {} } }),
    );
    const target = setupTypecheckHook(tmpDir);
    expect(target).toBe('.git/hooks/pre-commit');
    const content = fs.readFileSync(path.join(tmpDir, '.git', 'hooks', 'pre-commit'), 'utf-8');
    expect(content).toContain('npx turbo typecheck');
  });
});

describe('setupLintHook', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viberails-lint-'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('adds biome check for biome linter', () => {
    fs.mkdirSync(path.join(tmpDir, '.git'));
    const target = setupLintHook(tmpDir, 'biome');
    expect(target).toBe('.git/hooks/pre-commit');
    const content = fs.readFileSync(path.join(tmpDir, '.git', 'hooks', 'pre-commit'), 'utf-8');
    expect(content).toContain('npx biome check .');
  });

  it('adds eslint for eslint linter', () => {
    fs.mkdirSync(path.join(tmpDir, '.git'));
    const target = setupLintHook(tmpDir, 'eslint');
    expect(target).toBe('.git/hooks/pre-commit');
    const content = fs.readFileSync(path.join(tmpDir, '.git', 'hooks', 'pre-commit'), 'utf-8');
    expect(content).toContain('npx eslint .');
  });
});
