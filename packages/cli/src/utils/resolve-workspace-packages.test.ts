import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveWorkspacePackages } from './resolve-workspace-packages.js';

describe('resolveWorkspacePackages', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viberails-rwp-'));

    // Create a mini monorepo
    fs.mkdirSync(path.join(tmpDir, 'packages/core'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'packages/core/package.json'),
      JSON.stringify({ name: '@test/core', version: '1.0.0' }),
    );

    fs.mkdirSync(path.join(tmpDir, 'packages/web'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'packages/web/package.json'),
      JSON.stringify({
        name: '@test/web',
        version: '1.0.0',
        dependencies: { '@test/core': '*', react: '^18.0.0' },
      }),
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('resolves package names and absolute paths', () => {
    const result = resolveWorkspacePackages(tmpDir, {
      packages: ['packages/core', 'packages/web'],
      isMonorepo: true,
    });

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('@test/core');
    expect(result[0].path).toBe(path.join(tmpDir, 'packages/core'));
    expect(result[0].relativePath).toBe('packages/core');
    expect(result[1].name).toBe('@test/web');
  });

  it('filters internalDeps to workspace-only packages', () => {
    const result = resolveWorkspacePackages(tmpDir, {
      packages: ['packages/core', 'packages/web'],
      isMonorepo: true,
    });

    const web = result.find((p) => p.name === '@test/web')!;
    expect(web.internalDeps).toEqual(['@test/core']);
    // react should be filtered out
    expect(web.internalDeps).not.toContain('react');
  });

  it('skips packages without package.json', () => {
    fs.mkdirSync(path.join(tmpDir, 'packages/missing'), { recursive: true });
    const result = resolveWorkspacePackages(tmpDir, {
      packages: ['packages/core', 'packages/missing'],
      isMonorepo: true,
    });

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('@test/core');
  });

  it('returns empty array for no valid packages', () => {
    const result = resolveWorkspacePackages(tmpDir, {
      packages: ['packages/nonexistent'],
      isMonorepo: true,
    });
    expect(result).toEqual([]);
  });
});
