import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { detectStructure } from './detect-structure.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const fixturesDir = resolve(__dirname, '../../../tests/fixtures');

describe('detectStructure', () => {
  it('detects src directory when src/ exists with source files', async () => {
    const result = await detectStructure(join(fixturesDir, 'nextjs-15'));
    expect(result.srcDir).toBe('src');
  });

  it('returns "." srcDir for flat project structure', async () => {
    const result = await detectStructure(join(fixturesDir, 'flat-structure'));
    expect(result.srcDir).toBe('.');
  });

  it('classifies src/components as components role', async () => {
    const result = await detectStructure(join(fixturesDir, 'nextjs-15'));
    const components = result.directories.find((d) => d.path === 'src/components');
    expect(components).toBeDefined();
    expect(components?.role).toBe('components');
    expect(components?.confidence).toBe('high');
    expect(components?.fileCount).toBe(5);
  });

  it('classifies src/hooks as hooks role with high confidence', async () => {
    const result = await detectStructure(join(fixturesDir, 'nextjs-15'));
    const hooks = result.directories.find((d) => d.path === 'src/hooks');
    expect(hooks).toBeDefined();
    expect(hooks?.role).toBe('hooks');
    expect(hooks?.confidence).toBe('high');
  });

  it('classifies src/lib as utils role', async () => {
    const result = await detectStructure(join(fixturesDir, 'nextjs-15'));
    const lib = result.directories.find((d) => d.path === 'src/lib');
    expect(lib).toBeDefined();
    expect(lib?.role).toBe('utils');
    expect(lib?.confidence).toBe('high');
  });

  it('classifies __tests__ as tests role', async () => {
    const result = await detectStructure(join(fixturesDir, 'nextjs-15'));
    const tests = result.directories.find((d) => d.path === '__tests__');
    expect(tests).toBeDefined();
    expect(tests?.role).toBe('tests');
    expect(tests?.confidence).toBe('high');
  });

  it('classifies src/app/api as api role', async () => {
    const result = await detectStructure(join(fixturesDir, 'nextjs-15'));
    const api = result.directories.find((d) => d.path === 'src/app/api');
    expect(api).toBeDefined();
    expect(api?.role).toBe('api');
  });

  it('detects test pattern from test files', async () => {
    const result = await detectStructure(join(fixturesDir, 'nextjs-15'));
    expect(result.testPattern).toBeDefined();
    expect(result.testPattern?.value).toBe('*.test.ts');
    expect(result.testPattern?.sampleSize).toBeGreaterThanOrEqual(3);
  });

  it('classifies flat structure directories correctly', async () => {
    const result = await detectStructure(join(fixturesDir, 'flat-structure'));
    const components = result.directories.find((d) => d.path === 'components');
    expect(components).toBeDefined();
    expect(components?.role).toBe('components');

    const hooks = result.directories.find((d) => d.path === 'hooks');
    expect(hooks).toBeDefined();
    expect(hooks?.role).toBe('hooks');

    const lib = result.directories.find((d) => d.path === 'lib');
    expect(lib).toBeDefined();
    expect(lib?.role).toBe('utils');
  });

  it('handles empty project gracefully', async () => {
    const result = await detectStructure(join(fixturesDir, 'empty'));
    expect(result.directories).toEqual([]);
    expect(result.srcDir).toBe('.');
    expect(result.testPattern).toBeUndefined();
  });

  it('handles non-existent path gracefully', async () => {
    const result = await detectStructure('/nonexistent/path/xyz');
    expect(result.directories).toEqual([]);
  });

  describe('skips excluded directories', () => {
    let tempDir: string;

    beforeAll(async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'viberails-structure-'));
      await mkdir(join(tempDir, 'src', 'components'), { recursive: true });
      await mkdir(join(tempDir, 'node_modules', 'react'), { recursive: true });
      await writeFile(join(tempDir, 'src', 'components', 'app.tsx'), 'export {}');
      await writeFile(join(tempDir, 'node_modules', 'react', 'index.js'), 'module.exports = {}');
    });

    afterAll(async () => {
      await rm(tempDir, { recursive: true, force: true });
    });

    it('does not include node_modules in results', async () => {
      const result = await detectStructure(tempDir);
      const nodeModules = result.directories.find((d) => d.path.includes('node_modules'));
      expect(nodeModules).toBeUndefined();
      const components = result.directories.find((d) => d.path === 'src/components');
      expect(components).toBeDefined();
    });
  });
});
