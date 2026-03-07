import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { detectWorkspace } from './detect-workspace.js';

const FIXTURES = join(import.meta.dirname, '../../..', 'tests/fixtures');

describe('detectWorkspace', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    for (const dir of tempDirs) {
      await rm(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  async function createTempDir(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'viberails-workspace-'));
    tempDirs.push(dir);
    return dir;
  }

  it('detects packages from package.json workspaces field', async () => {
    const result = await detectWorkspace(join(FIXTURES, 'monorepo-basic'));

    expect(result).toBeDefined();
    expect(result?.patterns).toEqual(['packages/*']);
    expect(result?.packages).toHaveLength(3);

    const names = result?.packages.map((p) => p.name).sort();
    expect(names).toEqual(['@mono/api', '@mono/core', '@mono/web']);
  });

  it('returns undefined for single-package project', async () => {
    const result = await detectWorkspace(join(FIXTURES, 'nextjs-15'));
    expect(result).toBeUndefined();
  });

  it('correctly identifies internal dependencies between packages', async () => {
    const result = await detectWorkspace(join(FIXTURES, 'monorepo-basic'));

    const api = result?.packages.find((p) => p.name === '@mono/api');
    const web = result?.packages.find((p) => p.name === '@mono/web');
    const core = result?.packages.find((p) => p.name === '@mono/core');

    expect(api?.internalDeps).toEqual(['@mono/core']);
    expect(web?.internalDeps).toEqual(['@mono/core']);
    expect(core?.internalDeps).toEqual([]);
  });

  it('handles missing package.json in workspace directory gracefully', async () => {
    const dir = await createTempDir();
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({
        name: 'test-mono',
        private: true,
        workspaces: ['packages/*'],
      }),
    );
    await mkdir(join(dir, 'packages/valid/src'), { recursive: true });
    await writeFile(
      join(dir, 'packages/valid/package.json'),
      JSON.stringify({
        name: '@test/valid',
      }),
    );
    // Create a directory without package.json
    await mkdir(join(dir, 'packages/empty'), { recursive: true });

    const result = await detectWorkspace(dir);
    expect(result).toBeDefined();
    expect(result?.packages).toHaveLength(1);
    expect(result?.packages[0].name).toBe('@test/valid');
  });

  it('handles pnpm-workspace.yaml format', async () => {
    const dir = await createTempDir();
    await writeFile(join(dir, 'pnpm-workspace.yaml'), "packages:\n  - 'packages/*'\n");
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({
        name: 'test-mono',
        private: true,
      }),
    );
    await mkdir(join(dir, 'packages/lib'), { recursive: true });
    await writeFile(
      join(dir, 'packages/lib/package.json'),
      JSON.stringify({
        name: '@test/lib',
      }),
    );

    const result = await detectWorkspace(dir);
    expect(result).toBeDefined();
    expect(result?.patterns).toEqual(['packages/*']);
    expect(result?.packages).toHaveLength(1);
    expect(result?.packages[0].name).toBe('@test/lib');
  });

  it('sets correct relative paths for packages', async () => {
    const result = await detectWorkspace(join(FIXTURES, 'monorepo-basic'));
    const core = result?.packages.find((p) => p.name === '@mono/core');

    expect(core?.relativePath).toBe('packages/core');
  });

  it('handles workspaces as object with packages field', async () => {
    const dir = await createTempDir();
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({
        name: 'test-mono',
        private: true,
        workspaces: { packages: ['packages/*'] },
      }),
    );
    await mkdir(join(dir, 'packages/lib'), { recursive: true });
    await writeFile(
      join(dir, 'packages/lib/package.json'),
      JSON.stringify({
        name: '@test/lib',
      }),
    );

    const result = await detectWorkspace(dir);
    expect(result).toBeDefined();
    expect(result?.packages).toHaveLength(1);
  });
});
