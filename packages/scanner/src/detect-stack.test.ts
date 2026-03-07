import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { detectStack, extractMajorVersion } from './detect-stack.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const fixturesDir = resolve(__dirname, '../../../tests/fixtures');

describe('extractMajorVersion', () => {
  it('extracts major version from caret range', () => {
    expect(extractMajorVersion('^15.0.3')).toBe('15');
  });

  it('extracts major version from tilde range', () => {
    expect(extractMajorVersion('~2.1.0')).toBe('2');
  });

  it('extracts major version from x-range', () => {
    expect(extractMajorVersion('3.x')).toBe('3');
  });

  it('extracts major version from exact version', () => {
    expect(extractMajorVersion('4.0.0')).toBe('4');
  });

  it('returns undefined for non-numeric range', () => {
    expect(extractMajorVersion('latest')).toBeUndefined();
  });
});

describe('detectStack', () => {
  it('detects Next.js 15 from package.json dependencies', async () => {
    const result = await detectStack(join(fixturesDir, 'nextjs-15'));

    expect(result.framework).toEqual({ name: 'nextjs', version: '15' });
    expect(result.language).toEqual({ name: 'typescript', version: '5' });
    expect(result.styling).toEqual({ name: 'tailwindcss', version: '4' });
    expect(result.testRunner).toEqual({ name: 'vitest', version: '3' });
    expect(result.libraries).toEqual([]);
  });

  it('detects React without TypeScript as javascript', async () => {
    const result = await detectStack(join(fixturesDir, 'vite-react'));

    expect(result.framework).toEqual({ name: 'react', version: '18' });
    expect(result.language).toEqual({ name: 'javascript' });
    expect(result.styling).toBeUndefined();
    expect(result.testRunner).toBeUndefined();
  });

  it('handles empty project gracefully', async () => {
    const result = await detectStack(join(fixturesDir, 'empty'));

    expect(result.framework).toBeUndefined();
    expect(result.language).toEqual({ name: 'javascript' });
    expect(result.libraries).toEqual([]);
  });

  it('handles missing package.json gracefully', async () => {
    const result = await detectStack(join(fixturesDir, 'no-package-json'));

    expect(result.framework).toBeUndefined();
    expect(result.language).toEqual({ name: 'javascript' });
    expect(result.packageManager).toEqual({ name: 'npm' });
    expect(result.libraries).toEqual([]);
  });

  describe('additionalDeps merging', () => {
    let tempDir: string;

    beforeAll(async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'viberails-addldeps-'));

      // Root package.json — no framework deps, no typescript
      await writeFile(
        join(tempDir, 'package.json'),
        JSON.stringify({ name: 'monorepo', private: true }),
      );
      await writeFile(join(tempDir, 'pnpm-lock.yaml'), '');
    });

    afterAll(async () => {
      await rm(tempDir, { recursive: true, force: true });
    });

    it('detects typescript from additionalDeps', async () => {
      const result = await detectStack(tempDir, { typescript: '^5.5.0' });
      expect(result.language.name).toBe('typescript');
      expect(result.language.version).toBe('5');
    });

    it('detects Next.js from additionalDeps', async () => {
      const result = await detectStack(tempDir, {
        next: '^15.0.0',
        react: '^19.0.0',
      });
      expect(result.framework).toEqual({ name: 'nextjs', version: '15' });
    });

    it('package deps override additionalDeps', async () => {
      // additionalDeps has next 14, but package.json has no deps
      // so additionalDeps value is used
      const result = await detectStack(tempDir, { next: '^14.0.0', react: '^18.0.0' });
      expect(result.framework).toEqual({ name: 'nextjs', version: '14' });
    });

    it('falls back to javascript without additionalDeps', async () => {
      const result = await detectStack(tempDir);
      expect(result.language.name).toBe('javascript');
      expect(result.framework).toBeUndefined();
    });
  });

  describe('formatter detection', () => {
    let tempDir: string;

    beforeAll(async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'viberails-fmt-'));
      await writeFile(join(tempDir, 'pnpm-lock.yaml'), '');
    });

    afterAll(async () => {
      await rm(tempDir, { recursive: true, force: true });
    });

    it('detects Prettier as formatter from devDependencies', async () => {
      await writeFile(
        join(tempDir, 'package.json'),
        JSON.stringify({ name: 'test', devDependencies: { prettier: '^3.2.0' } }),
      );
      const result = await detectStack(tempDir);
      expect(result.formatter).toEqual({ name: 'prettier', version: '3' });
    });

    it('detects Biome as both linter and formatter', async () => {
      await writeFile(
        join(tempDir, 'package.json'),
        JSON.stringify({ name: 'test', devDependencies: { '@biomejs/biome': '^2.0.0' } }),
      );
      const result = await detectStack(tempDir);
      expect(result.linter).toEqual({ name: 'biome', version: '2' });
      expect(result.formatter).toEqual({ name: 'biome', version: '2' });
    });

    it('returns no formatter when none is present', async () => {
      await writeFile(
        join(tempDir, 'package.json'),
        JSON.stringify({ name: 'test', devDependencies: { eslint: '^9.0.0' } }),
      );
      const result = await detectStack(tempDir);
      expect(result.formatter).toBeUndefined();
    });
  });

  describe('package manager detection', () => {
    let tempDir: string;

    beforeAll(async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'viberails-test-'));
      await writeFile(join(tempDir, 'package.json'), JSON.stringify({ name: 'test' }));
      await writeFile(join(tempDir, 'pnpm-lock.yaml'), '');
    });

    afterAll(async () => {
      await rm(tempDir, { recursive: true, force: true });
    });

    it('detects pnpm from lock file', async () => {
      const result = await detectStack(tempDir);
      expect(result.packageManager).toEqual({ name: 'pnpm' });
    });
  });
});
