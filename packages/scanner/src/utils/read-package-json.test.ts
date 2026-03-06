import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readPackageJson } from './read-package-json.js';

describe('readPackageJson', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'pkg-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('returns parsed package.json for valid file', async () => {
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        dependencies: { react: '^18.0.0' },
        devDependencies: { vitest: '^1.0.0' },
      }),
    );

    const result = await readPackageJson(dir);
    expect(result).not.toBeNull();
    expect(result?.name).toBe('test-project');
    expect(result?.version).toBe('1.0.0');
    expect(result?.dependencies).toEqual({ react: '^18.0.0' });
    expect(result?.devDependencies).toEqual({ vitest: '^1.0.0' });
  });

  it('returns null for missing package.json', async () => {
    const result = await readPackageJson(dir);
    expect(result).toBeNull();
  });

  it('returns null for invalid JSON', async () => {
    await writeFile(join(dir, 'package.json'), 'not valid json {{{');

    const result = await readPackageJson(dir);
    expect(result).toBeNull();
  });

  it('handles package.json with minimal fields', async () => {
    await writeFile(join(dir, 'package.json'), '{}');

    const result = await readPackageJson(dir);
    expect(result).not.toBeNull();
    expect(result?.name).toBeUndefined();
    expect(result?.dependencies).toBeUndefined();
  });
});
