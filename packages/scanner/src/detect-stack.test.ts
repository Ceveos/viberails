import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, afterAll, beforeAll } from 'vitest';
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

  describe('package manager detection', () => {
    let tempDir: string;

    beforeAll(async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'viberails-test-'));
      await writeFile(
        join(tempDir, 'package.json'),
        JSON.stringify({ name: 'test' }),
      );
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
