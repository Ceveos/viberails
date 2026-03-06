import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { scan } from './scan.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const fixturesDir = resolve(__dirname, '../../../tests/fixtures');

describe('scan', () => {
  it('produces a complete ScanResult for nextjs-15 fixture', async () => {
    const result = await scan(join(fixturesDir, 'nextjs-15'));

    // Stack
    expect(result.stack.framework).toEqual({ name: 'nextjs', version: '15' });
    expect(result.stack.language).toEqual({ name: 'typescript', version: '5' });
    expect(result.stack.styling).toEqual({ name: 'tailwindcss', version: '4' });

    // Structure
    expect(result.structure.directories.length).toBeGreaterThan(0);
    expect(result.structure.srcDir).toBe('src');

    // Conventions
    expect(result.conventions).toHaveProperty('fileNaming');
    expect(result.conventions.fileNaming.value).toBe('kebab-case');

    // Statistics
    expect(result.statistics.totalFiles).toBeGreaterThan(0);
    expect(result.statistics.totalLines).toBeGreaterThan(0);
  });

  it('sets root to an absolute resolved path', async () => {
    const result = await scan(join(fixturesDir, 'nextjs-15'));

    expect(result.root).toBe(resolve(join(fixturesDir, 'nextjs-15')));
  });

  it('populates all required fields with no undefined values', async () => {
    const result = await scan(join(fixturesDir, 'nextjs-15'));

    expect(result.root).toBeDefined();
    expect(result.stack).toBeDefined();
    expect(result.stack.language).toBeDefined();
    expect(result.stack.packageManager).toBeDefined();
    expect(result.stack.libraries).toBeDefined();
    expect(result.structure).toBeDefined();
    expect(result.structure.directories).toBeDefined();
    expect(result.conventions).toBeDefined();
    expect(result.statistics).toBeDefined();
    expect(result.statistics.totalFiles).toBeDefined();
    expect(result.statistics.totalLines).toBeDefined();
    expect(result.statistics.averageFileLines).toBeDefined();
    expect(result.statistics.largestFiles).toBeDefined();
    expect(result.statistics.filesByExtension).toBeDefined();
  });

  it('produces a JSON-serializable result', async () => {
    const result = await scan(join(fixturesDir, 'nextjs-15'));

    const serialized = JSON.stringify(result);
    const deserialized = JSON.parse(serialized);
    expect(deserialized).toEqual(result);
  });

  it('throws for non-existent project path', async () => {
    await expect(scan('/non/existent/path')).rejects.toThrow('Project path does not exist');
  });

  it('matches snapshot for nextjs-15 fixture', async () => {
    const result = await scan(join(fixturesDir, 'nextjs-15'));

    // Replace root with a placeholder so snapshots are portable
    const snapshot = { ...result, root: '<PROJECT_ROOT>' };
    expect(snapshot).toMatchSnapshot();
  });
});
