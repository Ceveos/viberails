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

  it('returns a single package for single-package projects', async () => {
    const result = await scan(join(fixturesDir, 'nextjs-15'));

    expect(result.packages).toHaveLength(1);
    expect(result.packages[0].relativePath).toBe('');
    expect(result.packages[0].stack).toEqual(result.stack);
    expect(result.packages[0].structure).toEqual(result.structure);
    expect(result.packages[0].conventions).toEqual(result.conventions);
    expect(result.packages[0].statistics).toEqual(result.statistics);
  });

  describe('monorepo with Next.js + Expo fixture', () => {
    it('detects Next.js as primary framework from workspace packages', async () => {
      const result = await scan(join(fixturesDir, 'monorepo-nextjs-expo'));
      expect(result.stack.framework).toEqual({ name: 'nextjs', version: '15' });
    });

    it('detects Expo as additional library', async () => {
      const result = await scan(join(fixturesDir, 'monorepo-nextjs-expo'));
      const expoLib = result.stack.libraries.find((l) => l.name === 'expo');
      expect(expoLib).toBeDefined();
      expect(expoLib?.version).toBe('53');
    });

    it('detects TypeScript from workspace package deps', async () => {
      const result = await scan(join(fixturesDir, 'monorepo-nextjs-expo'));
      expect(result.stack.language.name).toBe('typescript');
    });

    it('detects Tailwind CSS from workspace package deps', async () => {
      const result = await scan(join(fixturesDir, 'monorepo-nextjs-expo'));
      expect(result.stack.styling).toEqual({ name: 'tailwindcss', version: '4' });
    });

    it('detects Zod from workspace package deps', async () => {
      const result = await scan(join(fixturesDir, 'monorepo-nextjs-expo'));
      const zodLib = result.stack.libraries.find((l) => l.name === 'zod');
      expect(zodLib).toBeDefined();
    });

    it('classifies apps/web/components as components', async () => {
      const result = await scan(join(fixturesDir, 'monorepo-nextjs-expo'));
      const compDir = result.structure.directories.find((d) => d.path === 'apps/web/components');
      expect(compDir).toBeDefined();
      expect(compDir?.role).toBe('components');
    });

    it('classifies apps/web/lib as utils (not hooks)', async () => {
      const result = await scan(join(fixturesDir, 'monorepo-nextjs-expo'));
      const libDir = result.structure.directories.find((d) => d.path === 'apps/web/lib');
      expect(libDir).toBeDefined();
      expect(libDir?.role).toBe('utils');
    });

    it('classifies apps/mobile/hooks as hooks', async () => {
      const result = await scan(join(fixturesDir, 'monorepo-nextjs-expo'));
      const hooksDir = result.structure.directories.find((d) => d.path === 'apps/mobile/hooks');
      expect(hooksDir).toBeDefined();
      expect(hooksDir?.role).toBe('hooks');
    });

    it('classifies apps/web/app/api as api', async () => {
      const result = await scan(join(fixturesDir, 'monorepo-nextjs-expo'));
      const apiDir = result.structure.directories.find((d) => d.path === 'apps/web/app/api');
      expect(apiDir).toBeDefined();
      expect(apiDir?.role).toBe('api');
    });

    it('detects workspace with correct packages', async () => {
      const result = await scan(join(fixturesDir, 'monorepo-nextjs-expo'));
      expect(result.workspace).toBeDefined();
      expect(result.workspace?.packages.length).toBe(3);
      const names = result.workspace?.packages.map((p) => p.name).sort();
      expect(names).toEqual(['@app/mobile', '@app/shared', '@app/web']);
    });

    it('returns per-package scan results', async () => {
      const result = await scan(join(fixturesDir, 'monorepo-nextjs-expo'));
      expect(result.packages).toHaveLength(3);

      const web = result.packages.find((p) => p.name === '@app/web');
      const mobile = result.packages.find((p) => p.name === '@app/mobile');
      const shared = result.packages.find((p) => p.name === '@app/shared');

      expect(web).toBeDefined();
      expect(web?.stack.framework?.name).toBe('nextjs');
      expect(web?.relativePath).toBe('apps/web');

      expect(mobile).toBeDefined();
      expect(mobile?.stack.framework?.name).toBe('expo');
      expect(mobile?.relativePath).toBe('apps/mobile');

      expect(shared).toBeDefined();
      expect(shared?.relativePath).toBe('packages/shared');
    });
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
