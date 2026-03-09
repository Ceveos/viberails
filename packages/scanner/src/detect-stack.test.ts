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

  describe('Remix and Nuxt detection', () => {
    let tempDir: string;

    beforeAll(async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'viberails-remix-nuxt-'));
      await writeFile(join(tempDir, 'pnpm-lock.yaml'), '');
    });

    afterAll(async () => {
      await rm(tempDir, { recursive: true, force: true });
    });

    it('detects Remix from @remix-run/react dependency', async () => {
      await writeFile(
        join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'test',
          dependencies: { '@remix-run/react': '^2.0.0', react: '^18.0.0' },
        }),
      );
      const result = await detectStack(tempDir);
      expect(result.framework).toEqual({ name: 'remix', version: '2' });
    });

    it('detects Nuxt from nuxt dependency', async () => {
      await writeFile(
        join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'test',
          dependencies: { nuxt: '^3.0.0', vue: '^3.0.0' },
        }),
      );
      const result = await detectStack(tempDir);
      expect(result.framework).toEqual({ name: 'nuxt', version: '3' });
    });

    it('does not report vue when nuxt is present', async () => {
      await writeFile(
        join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'test',
          dependencies: { nuxt: '^3.0.0', vue: '^3.0.0' },
        }),
      );
      const result = await detectStack(tempDir);
      expect(result.framework?.name).toBe('nuxt');
    });
  });

  describe('ORM detection', () => {
    let tempDir: string;

    beforeAll(async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'viberails-orm-'));
      await writeFile(join(tempDir, 'pnpm-lock.yaml'), '');
    });

    afterAll(async () => {
      await rm(tempDir, { recursive: true, force: true });
    });

    it('detects Prisma from @prisma/client', async () => {
      await writeFile(
        join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'test',
          dependencies: { '@prisma/client': '^5.0.0' },
        }),
      );
      const result = await detectStack(tempDir);
      expect(result.orm).toEqual({ name: 'prisma', version: '5' });
    });

    it('detects Drizzle from drizzle-orm', async () => {
      await writeFile(
        join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'test',
          dependencies: { 'drizzle-orm': '^0.30.0' },
        }),
      );
      const result = await detectStack(tempDir);
      expect(result.orm).toEqual({ name: 'drizzle', version: '0' });
    });

    it('detects ORM separately from backend (Express + Prisma)', async () => {
      await writeFile(
        join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'test',
          dependencies: { express: '^4.0.0', '@prisma/client': '^5.0.0' },
        }),
      );
      const result = await detectStack(tempDir);
      expect(result.backend).toEqual({ name: 'express', version: '4' });
      expect(result.orm).toEqual({ name: 'prisma', version: '5' });
    });
  });

  describe('excludeDeps behavior', () => {
    let tempDir: string;

    beforeAll(async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'viberails-exclude-'));
      await writeFile(join(tempDir, 'pnpm-lock.yaml'), '');
    });

    afterAll(async () => {
      await rm(tempDir, { recursive: true, force: true });
    });

    it('does not detect React when Remix is present', async () => {
      await writeFile(
        join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'test',
          dependencies: { '@remix-run/react': '^2.0.0', react: '^18.0.0' },
        }),
      );
      const result = await detectStack(tempDir);
      expect(result.framework?.name).toBe('remix');
    });

    it('does not detect React when Gatsby is present', async () => {
      await writeFile(
        join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'test',
          dependencies: { gatsby: '^5.0.0', react: '^18.0.0' },
        }),
      );
      const result = await detectStack(tempDir);
      expect(result.framework?.name).toBe('gatsby');
    });

    it('does not detect Svelte when Astro is present', async () => {
      await writeFile(
        join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'test',
          dependencies: { astro: '^4.0.0', svelte: '^4.0.0' },
        }),
      );
      const result = await detectStack(tempDir);
      expect(result.framework?.name).toBe('astro');
    });
  });

  describe('new framework and library detection', () => {
    let tempDir: string;

    beforeAll(async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'viberails-newfw-'));
      await writeFile(join(tempDir, 'pnpm-lock.yaml'), '');
    });

    afterAll(async () => {
      await rm(tempDir, { recursive: true, force: true });
    });

    it('detects Solid.js from solid-js', async () => {
      await writeFile(
        join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'test',
          dependencies: { 'solid-js': '^1.8.0' },
        }),
      );
      const result = await detectStack(tempDir);
      expect(result.framework).toEqual({ name: 'solidjs', version: '1' });
    });

    it('detects Electron', async () => {
      await writeFile(
        join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'test',
          devDependencies: { electron: '^28.0.0' },
        }),
      );
      const result = await detectStack(tempDir);
      expect(result.framework).toEqual({ name: 'electron', version: '28' });
    });

    it('detects tRPC from @trpc/server alone', async () => {
      await writeFile(
        join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'test',
          dependencies: { '@trpc/server': '^11.0.0' },
        }),
      );
      const result = await detectStack(tempDir);
      expect(result.libraries.find((l) => l.name === 'trpc')).toEqual({
        name: 'trpc',
        version: '11',
      });
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

  describe('package manager detection from packageManager field', () => {
    let tempDir: string;

    beforeAll(async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'viberails-pm-field-'));
    });

    afterAll(async () => {
      await rm(tempDir, { recursive: true, force: true });
    });

    it('detects pnpm from packageManager field when no lock file exists', async () => {
      await writeFile(
        join(tempDir, 'package.json'),
        JSON.stringify({ name: 'test', packageManager: 'pnpm@10.6.4' }),
      );
      const result = await detectStack(tempDir);
      expect(result.packageManager).toEqual({ name: 'pnpm' });
    });

    it('detects yarn from packageManager field', async () => {
      await writeFile(
        join(tempDir, 'package.json'),
        JSON.stringify({ name: 'test', packageManager: 'yarn@4.0.0' }),
      );
      const result = await detectStack(tempDir);
      expect(result.packageManager).toEqual({ name: 'yarn' });
    });

    it('defaults to npm when no lock file and no packageManager field', async () => {
      await writeFile(join(tempDir, 'package.json'), JSON.stringify({ name: 'test' }));
      const result = await detectStack(tempDir);
      expect(result.packageManager).toEqual({ name: 'npm' });
    });
  });
});
