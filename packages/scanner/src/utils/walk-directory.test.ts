import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { walkDirectory } from './walk-directory.js';

describe('walkDirectory', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'walk-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('returns empty array for empty directory', async () => {
    const result = await walkDirectory(dir);
    expect(result).toEqual([]);
  });

  it('collects source files with correct extensions', async () => {
    await mkdir(join(dir, 'src'));
    await writeFile(join(dir, 'src', 'app.ts'), '');
    await writeFile(join(dir, 'src', 'style.css'), '');
    await writeFile(join(dir, 'src', 'readme.md'), '');
    await writeFile(join(dir, 'src', 'component.tsx'), '');
    await writeFile(join(dir, 'src', 'main.js'), '');
    await writeFile(join(dir, 'src', 'config.mjs'), '');
    await writeFile(join(dir, 'src', 'utils.cjs'), '');

    const result = await walkDirectory(dir);
    const srcDir = result.find((d) => d.relativePath === 'src');
    expect(srcDir).toBeDefined();
    expect(srcDir?.sourceFileCount).toBe(5);
    expect(srcDir?.sourceFileNames).toContain('app.ts');
    expect(srcDir?.sourceFileNames).toContain('component.tsx');
    expect(srcDir?.sourceFileNames).toContain('main.js');
    expect(srcDir?.sourceFileNames).toContain('config.mjs');
    expect(srcDir?.sourceFileNames).toContain('utils.cjs');
    expect(srcDir?.sourceFileNames).not.toContain('style.css');
    expect(srcDir?.sourceFileNames).not.toContain('readme.md');
  });

  it('skips ignored directories', async () => {
    await mkdir(join(dir, 'node_modules'));
    await writeFile(join(dir, 'node_modules', 'pkg.js'), '');
    await mkdir(join(dir, '.git'));
    await writeFile(join(dir, '.git', 'HEAD'), '');
    await mkdir(join(dir, 'dist'));
    await writeFile(join(dir, 'dist', 'index.js'), '');
    await mkdir(join(dir, '.next'));
    await mkdir(join(dir, 'coverage'));
    await mkdir(join(dir, 'src'));
    await writeFile(join(dir, 'src', 'app.ts'), '');

    const result = await walkDirectory(dir);
    const paths = result.map((d) => d.relativePath);
    expect(paths).toContain('src');
    expect(paths).not.toContain('node_modules');
    expect(paths).not.toContain('.git');
    expect(paths).not.toContain('dist');
    expect(paths).not.toContain('.next');
    expect(paths).not.toContain('coverage');
  });

  it('respects maxDepth parameter', async () => {
    // Create nested directories 4 levels deep
    await mkdir(join(dir, 'a', 'b', 'c', 'd'), { recursive: true });
    await writeFile(join(dir, 'a', 'file.ts'), '');
    await writeFile(join(dir, 'a', 'b', 'file.ts'), '');
    await writeFile(join(dir, 'a', 'b', 'c', 'file.ts'), '');
    await writeFile(join(dir, 'a', 'b', 'c', 'd', 'file.ts'), '');

    // Default maxDepth=4 should include all 4
    const result4 = await walkDirectory(dir, 4);
    const paths4 = result4.map((d) => d.relativePath);
    expect(paths4).toContain('a');
    expect(paths4).toContain('a/b');
    expect(paths4).toContain('a/b/c');
    expect(paths4).toContain('a/b/c/d');

    // maxDepth=2 should only include first 2
    const result2 = await walkDirectory(dir, 2);
    const paths2 = result2.map((d) => d.relativePath);
    expect(paths2).toContain('a');
    expect(paths2).toContain('a/b');
    expect(paths2).not.toContain('a/b/c');
    expect(paths2).not.toContain('a/b/c/d');

    // maxDepth=1 should only include top level
    const result1 = await walkDirectory(dir, 1);
    const paths1 = result1.map((d) => d.relativePath);
    expect(paths1).toContain('a');
    expect(paths1).not.toContain('a/b');
  });

  it('ignores symbolic links', async () => {
    await mkdir(join(dir, 'real'));
    await writeFile(join(dir, 'real', 'file.ts'), '');
    try {
      await symlink(join(dir, 'real'), join(dir, 'linked'), 'dir');
    } catch {
      // Symlinks may not be supported on all platforms
      return;
    }

    const result = await walkDirectory(dir);
    const paths = result.map((d) => d.relativePath);
    expect(paths).toContain('real');
    expect(paths).not.toContain('linked');
  });

  it('returns correct depth values', async () => {
    await mkdir(join(dir, 'a', 'b'), { recursive: true });
    await writeFile(join(dir, 'a', 'file.ts'), '');
    await writeFile(join(dir, 'a', 'b', 'file.ts'), '');

    const result = await walkDirectory(dir);
    const aDir = result.find((d) => d.relativePath === 'a');
    const bDir = result.find((d) => d.relativePath === 'a/b');
    expect(aDir?.depth).toBe(1);
    expect(bDir?.depth).toBe(2);
  });

  it('returns correct absolute paths', async () => {
    await mkdir(join(dir, 'src'));
    await writeFile(join(dir, 'src', 'app.ts'), '');

    const result = await walkDirectory(dir);
    const srcDir = result.find((d) => d.relativePath === 'src');
    expect(srcDir?.absolutePath).toBe(join(dir, 'src'));
  });

  it('includes directories with no source files', async () => {
    await mkdir(join(dir, 'empty-dir'));
    await mkdir(join(dir, 'has-files'));
    await writeFile(join(dir, 'has-files', 'app.ts'), '');

    const result = await walkDirectory(dir);
    const emptyDir = result.find((d) => d.relativePath === 'empty-dir');
    expect(emptyDir).toBeDefined();
    expect(emptyDir?.sourceFileCount).toBe(0);
    expect(emptyDir?.sourceFileNames).toEqual([]);
  });

  it('returns empty array for non-existent directory', async () => {
    const result = await walkDirectory('/nonexistent/path');
    expect(result).toEqual([]);
  });

  it('handles vue, svelte, and astro files', async () => {
    await mkdir(join(dir, 'src'));
    await writeFile(join(dir, 'src', 'App.vue'), '');
    await writeFile(join(dir, 'src', 'Counter.svelte'), '');
    await writeFile(join(dir, 'src', 'Page.astro'), '');

    const result = await walkDirectory(dir);
    const srcDir = result.find((d) => d.relativePath === 'src');
    expect(srcDir?.sourceFileCount).toBe(3);
    expect(srcDir?.sourceFileNames).toContain('App.vue');
    expect(srcDir?.sourceFileNames).toContain('Counter.svelte');
    expect(srcDir?.sourceFileNames).toContain('Page.astro');
  });
});
