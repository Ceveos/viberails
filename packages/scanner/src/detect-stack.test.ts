import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
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

  describe('workspace dependency aggregation', () => {
    let tempDir: string;
    let webDir: string;
    let mobileDir: string;

    beforeAll(async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'viberails-workspace-'));
      webDir = join(tempDir, 'apps', 'web');
      mobileDir = join(tempDir, 'apps', 'mobile');

      await mkdir(webDir, { recursive: true });
      await mkdir(mobileDir, { recursive: true });

      // Root package.json — no framework deps, no typescript
      await writeFile(
        join(tempDir, 'package.json'),
        JSON.stringify({ name: 'monorepo', private: true }),
      );
      await writeFile(join(tempDir, 'pnpm-lock.yaml'), '');

      // Web package has Next.js + TypeScript
      await writeFile(
        join(webDir, 'package.json'),
        JSON.stringify({
          name: '@app/web',
          dependencies: { next: '^15.0.0', react: '^19.0.0' },
          devDependencies: { typescript: '^5.5.0' },
        }),
      );
      await writeFile(join(webDir, 'tsconfig.json'), '{}');

      // Mobile package has Expo
      await writeFile(
        join(mobileDir, 'package.json'),
        JSON.stringify({
          name: '@app/mobile',
          dependencies: { expo: '^53.0.0', 'react-native': '^0.76.0' },
        }),
      );
    });

    afterAll(async () => {
      await rm(tempDir, { recursive: true, force: true });
    });

    it('detects typescript from workspace package deps', async () => {
      const result = await detectStack(tempDir, [webDir, mobileDir]);
      expect(result.language.name).toBe('typescript');
    });

    it('detects Next.js as primary framework from workspace deps', async () => {
      const result = await detectStack(tempDir, [webDir, mobileDir]);
      expect(result.framework).toEqual({ name: 'nextjs', version: '15' });
    });

    it('detects Expo as additional library from workspace deps', async () => {
      const result = await detectStack(tempDir, [webDir, mobileDir]);
      const expoLib = result.libraries.find((l) => l.name === 'expo');
      expect(expoLib).toEqual({ name: 'expo', version: '53' });
    });

    it('does not include react when next is present (excludeDep)', async () => {
      const result = await detectStack(tempDir, [webDir, mobileDir]);
      const reactLib = result.libraries.find((l) => l.name === 'react');
      expect(reactLib).toBeUndefined();
    });

    it('does not include react-native when expo is present (excludeDep)', async () => {
      const result = await detectStack(tempDir, [webDir, mobileDir]);
      const rnLib = result.libraries.find((l) => l.name === 'react-native');
      expect(rnLib).toBeUndefined();
    });

    it('falls back to javascript without workspace dirs', async () => {
      const result = await detectStack(tempDir);
      expect(result.language.name).toBe('javascript');
      expect(result.framework).toBeUndefined();
    });
  });

  describe('workspace typescript detection via tsconfig.json', () => {
    let tempDir: string;
    let pkgDir: string;

    beforeAll(async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'viberails-tsconfig-'));
      pkgDir = join(tempDir, 'packages', 'core');
      await mkdir(pkgDir, { recursive: true });

      // Root has no typescript dep and no tsconfig
      await writeFile(join(tempDir, 'package.json'), JSON.stringify({ name: 'monorepo' }));

      // Workspace package has tsconfig but no typescript dep
      await writeFile(join(pkgDir, 'package.json'), JSON.stringify({ name: '@app/core' }));
      await writeFile(join(pkgDir, 'tsconfig.json'), '{}');
    });

    afterAll(async () => {
      await rm(tempDir, { recursive: true, force: true });
    });

    it('detects typescript from workspace package tsconfig.json', async () => {
      const result = await detectStack(tempDir, [pkgDir]);
      expect(result.language.name).toBe('typescript');
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
