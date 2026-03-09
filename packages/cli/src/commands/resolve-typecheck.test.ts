import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hasTurboTask, resolveTypecheckCommand } from './resolve-typecheck.js';

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

describe('resolveTypecheckCommand', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viberails-resolve-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('uses turbo typecheck when turbo task is defined', () => {
    fs.writeFileSync(path.join(tmpDir, 'turbo.json'), JSON.stringify({ tasks: { typecheck: {} } }));
    const result = resolveTypecheckCommand(tmpDir);
    expect(result.command).toBe('npx turbo typecheck');
    expect(result.label).toBe('turbo typecheck');
  });

  it('uses package.json typecheck script when available', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ scripts: { typecheck: 'tsc --noEmit' } }),
    );
    const result = resolveTypecheckCommand(tmpDir, 'pnpm');
    expect(result.command).toBe('pnpm run typecheck');
    expect(result.label).toBe('pnpm run typecheck');
  });

  it('defaults to npm for package.json script when no pm specified', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ scripts: { typecheck: 'tsc --noEmit' } }),
    );
    const result = resolveTypecheckCommand(tmpDir);
    expect(result.command).toBe('npm run typecheck');
  });

  it('prefers turbo task over package.json script', () => {
    fs.writeFileSync(path.join(tmpDir, 'turbo.json'), JSON.stringify({ tasks: { typecheck: {} } }));
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ scripts: { typecheck: 'tsc --noEmit' } }),
    );
    const result = resolveTypecheckCommand(tmpDir);
    expect(result.command).toBe('npx turbo typecheck');
  });

  it('falls back to tsc --noEmit when root tsconfig.json exists', () => {
    fs.writeFileSync(path.join(tmpDir, 'tsconfig.json'), '{}');
    const result = resolveTypecheckCommand(tmpDir);
    expect(result.command).toBe('npx tsc --noEmit');
    expect(result.label).toBe('tsc --noEmit');
  });

  it('skips when no safe command can be inferred', () => {
    const result = resolveTypecheckCommand(tmpDir);
    expect(result.command).toBeUndefined();
    expect(result.reason).toBeDefined();
  });

  it('skips for monorepo with turbo.json but no typecheck task and no root tsconfig', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'turbo.json'),
      JSON.stringify({ tasks: { build: {}, test: {} } }),
    );
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ scripts: { build: 'turbo build' } }),
    );
    const result = resolveTypecheckCommand(tmpDir);
    expect(result.command).toBeUndefined();
    expect(result.reason).toContain('no root tsconfig.json');
  });
});
