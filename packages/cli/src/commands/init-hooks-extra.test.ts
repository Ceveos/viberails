import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addPreCommitStep,
  setupLintHook,
  setupSelectedIntegrations,
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

  it('adds tsc --noEmit when root tsconfig.json exists', () => {
    fs.mkdirSync(path.join(tmpDir, '.git'));
    fs.writeFileSync(path.join(tmpDir, 'tsconfig.json'), '{}');
    const target = setupTypecheckHook(tmpDir);
    expect(target).toBe('.git/hooks/pre-commit');
    const content = fs.readFileSync(path.join(tmpDir, '.git', 'hooks', 'pre-commit'), 'utf-8');
    expect(content).toContain('npx tsc --noEmit');
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

  it('uses package.json typecheck script with specified package manager', () => {
    fs.mkdirSync(path.join(tmpDir, '.git'));
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ scripts: { typecheck: 'tsc -b --noEmit' } }),
    );
    const target = setupTypecheckHook(tmpDir, 'pnpm');
    expect(target).toBe('.git/hooks/pre-commit');
    const content = fs.readFileSync(path.join(tmpDir, '.git', 'hooks', 'pre-commit'), 'utf-8');
    expect(content).toContain('pnpm run typecheck');
  });

  it('skips and warns when no safe command can be inferred', () => {
    fs.mkdirSync(path.join(tmpDir, '.git'));
    const target = setupTypecheckHook(tmpDir);
    expect(target).toBeUndefined();
    // Should not have created the hook file
    expect(fs.existsSync(path.join(tmpDir, '.git', 'hooks', 'pre-commit'))).toBe(false);
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

  it('adds biome check scoped to staged files for bare git hooks', () => {
    fs.mkdirSync(path.join(tmpDir, '.git'));
    const target = setupLintHook(tmpDir, 'biome');
    expect(target).toBe('.git/hooks/pre-commit');
    const content = fs.readFileSync(path.join(tmpDir, '.git', 'hooks', 'pre-commit'), 'utf-8');
    expect(content).toContain('git diff --cached');
    expect(content).toContain('xargs npx biome check --write');
  });

  it('adds eslint scoped to staged files for bare git hooks', () => {
    fs.mkdirSync(path.join(tmpDir, '.git'));
    const target = setupLintHook(tmpDir, 'eslint');
    expect(target).toBe('.git/hooks/pre-commit');
    const content = fs.readFileSync(path.join(tmpDir, '.git', 'hooks', 'pre-commit'), 'utf-8');
    expect(content).toContain('git diff --cached');
    expect(content).toContain('xargs npx eslint --fix');
  });

  it('uses lefthook staged_files and glob when lefthook.yml exists', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'lefthook.yml'),
      'pre-commit:\n  commands:\n    format:\n      run: echo format\n',
    );
    const target = setupLintHook(tmpDir, 'eslint');
    expect(target).toBe('lefthook.yml');
    const content = fs.readFileSync(path.join(tmpDir, 'lefthook.yml'), 'utf-8');
    expect(content).toContain('eslint --fix {staged_files}');
    expect(content).toContain('glob');
    expect(content).toContain('*.{js,ts,jsx,tsx}');
    expect(content).toContain('stage_fixed');
  });

  it('uses broader glob for biome in lefthook', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'lefthook.yml'),
      'pre-commit:\n  commands:\n    format:\n      run: echo format\n',
    );
    setupLintHook(tmpDir, 'biome');
    const content = fs.readFileSync(path.join(tmpDir, 'lefthook.yml'), 'utf-8');
    expect(content).toContain('npx biome check --write {staged_files}');
    expect(content).toContain('*.{js,ts,jsx,tsx,json,css}');
    expect(content).toContain('stage_fixed');
  });
});

describe('setupSelectedIntegrations', () => {
  let tmpDir: string;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viberails-integ-'));
    fs.mkdirSync(path.join(tmpDir, '.git'));
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('warns when lefthookExpected but falls back to local git hook', () => {
    const integrations = {
      preCommitHook: true,
      claudeCodeHook: false,
      claudeMdRef: false,
      githubAction: false,
      typecheckHook: false,
      lintHook: false,
    };
    setupSelectedIntegrations(tmpDir, integrations, { lefthookExpected: true });
    const calls = logSpy.mock.calls.map((c: unknown[]) => c[0]);
    expect(
      calls.some((c: unknown) => typeof c === 'string' && c.includes('Lefthook install failed')),
    ).toBe(true);
  });

  it('does not warn when lefthookExpected and lefthook.yml exists', () => {
    fs.writeFileSync(path.join(tmpDir, 'lefthook.yml'), '# Generated by viberails\n');
    const integrations = {
      preCommitHook: true,
      claudeCodeHook: false,
      claudeMdRef: false,
      githubAction: false,
      typecheckHook: false,
      lintHook: false,
    };
    setupSelectedIntegrations(tmpDir, integrations, { lefthookExpected: true });
    const calls = logSpy.mock.calls.map((c: unknown[]) => c[0]);
    expect(
      calls.some((c: unknown) => typeof c === 'string' && c.includes('Lefthook install failed')),
    ).toBe(false);
  });

  it('uses local git hook without warning when lefthook not expected', () => {
    const integrations = {
      preCommitHook: true,
      claudeCodeHook: false,
      claudeMdRef: false,
      githubAction: false,
      typecheckHook: false,
      lintHook: false,
    };
    setupSelectedIntegrations(tmpDir, integrations, {});
    const calls = logSpy.mock.calls.map((c: unknown[]) => c[0]);
    expect(
      calls.some((c: unknown) => typeof c === 'string' && c.includes('Lefthook install failed')),
    ).toBe(false);
  });
});
