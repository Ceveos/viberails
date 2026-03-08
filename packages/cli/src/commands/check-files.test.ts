import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { ViberailsConfig } from '@viberails/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkNaming, getAllSourceFiles, isIgnored } from './check-files.js';

describe('checkNaming', () => {
  const conventions = { fileNaming: 'kebab-case' as const };

  it('detects violations for normal PascalCase files', () => {
    const result = checkNaming('src/UserProfile.tsx', conventions);
    expect(result).toBeDefined();
    expect(result).toContain('kebab-case');
  });

  it('skips files starting with underscore', () => {
    expect(checkNaming('app/_layout.tsx', conventions)).toBeUndefined();
    expect(checkNaming('pages/_app.tsx', conventions)).toBeUndefined();
    expect(checkNaming('pages/_document.tsx', conventions)).toBeUndefined();
    expect(checkNaming('pages/_error.tsx', conventions)).toBeUndefined();
  });

  it('skips files starting with + (SvelteKit)', () => {
    expect(checkNaming('routes/+page.svelte', conventions)).toBeUndefined();
    expect(checkNaming('routes/+layout.svelte', conventions)).toBeUndefined();
    expect(checkNaming('routes/+server.ts', conventions)).toBeUndefined();
  });

  it('skips files starting with $ (Remix/SvelteKit)', () => {
    expect(checkNaming('routes/$types.ts', conventions)).toBeUndefined();
  });

  it('skips files starting with [ (Next.js dynamic routes)', () => {
    expect(checkNaming('pages/[slug].tsx', conventions)).toBeUndefined();
    expect(checkNaming('pages/[...catchAll].tsx', conventions)).toBeUndefined();
  });

  it('skips index files', () => {
    expect(checkNaming('src/index.ts', conventions)).toBeUndefined();
  });

  it('skips test and spec files', () => {
    expect(checkNaming('src/UserProfile.test.ts', conventions)).toBeUndefined();
    expect(checkNaming('src/UserProfile.spec.ts', conventions)).toBeUndefined();
  });

  it('skips config files', () => {
    expect(checkNaming('tailwind.config.ts', conventions)).toBeUndefined();
  });

  it('skips non-source files', () => {
    expect(checkNaming('README.md', conventions)).toBeUndefined();
  });

  it('returns undefined when no convention is set', () => {
    expect(checkNaming('UserProfile.tsx', {})).toBeUndefined();
  });
});

describe('isIgnored', () => {
  it('matches directory prefix patterns like dist/**', () => {
    expect(isIgnored('dist/index.js', ['dist/**'])).toBe(true);
  });

  it('matches build output directories', () => {
    expect(isIgnored('.next/cache/foo.ts', ['.next/**'])).toBe(true);
    expect(isIgnored('.expo/web/foo.ts', ['.expo/**'])).toBe(true);
    expect(isIgnored('build/output.js', ['build/**'])).toBe(true);
    expect(isIgnored('public/assets/logo.svg', ['public/**'])).toBe(true);
  });

  it('matches suffix patterns like **/file.ext', () => {
    expect(isIgnored('src/types.generated.ts', ['**/types.generated.ts'])).toBe(true);
  });

  it('does not match unrelated paths', () => {
    expect(isIgnored('src/utils.ts', ['dist/**'])).toBe(false);
  });

  it('matches glob brace patterns like **/*.{css,scss}', () => {
    expect(isIgnored('src/styles/main.css', ['**/*.{css,scss}'])).toBe(true);
    expect(isIgnored('src/styles/theme.scss', ['**/*.{css,scss}'])).toBe(true);
    expect(isIgnored('src/styles/theme.ts', ['**/*.{css,scss}'])).toBe(false);
  });

  it('matches character class patterns like [abc]', () => {
    expect(isIgnored('src/a.ts', ['src/[abc].ts'])).toBe(true);
    expect(isIgnored('src/d.ts', ['src/[abc].ts'])).toBe(false);
  });

  it('matches directory-anywhere patterns like **/vendor/**', () => {
    expect(isIgnored('lib/vendor/dep.ts', ['**/vendor/**'])).toBe(true);
    expect(isIgnored('vendor/dep.ts', ['**/vendor/**'])).toBe(true);
  });

  it('matches wildcard filename patterns like *.config.*', () => {
    expect(isIgnored('tailwind.config.ts', ['*.config.*'])).toBe(true);
    expect(isIgnored('vitest.config.ts', ['*.config.*'])).toBe(true);
    expect(isIgnored('utils.ts', ['*.config.*'])).toBe(false);
  });

  it('returns false for empty patterns array', () => {
    expect(isIgnored('src/utils.ts', [])).toBe(false);
  });

  it('matches dotfiles when pattern includes dot', () => {
    expect(isIgnored('.env', ['.env'])).toBe(true);
    expect(isIgnored('.env.local', ['.env*'])).toBe(true);
  });

  it('matches multiple patterns (any match returns true)', () => {
    expect(isIgnored('dist/bundle.js', ['src/**', 'dist/**'])).toBe(true);
    expect(isIgnored('lib/utils.ts', ['src/**', 'dist/**'])).toBe(false);
  });
});

describe('getAllSourceFiles', () => {
  let tmpDir: string;

  const baseConfig: ViberailsConfig = {
    version: 1,
    name: 'test',
    rules: {
      maxFileLines: 300,
      maxTestFileLines: 0,
      testCoverage: 80,
      enforceNaming: true,
      enforceBoundaries: false,
    },
    ignore: [],
    packages: [
      {
        name: 'test',
        path: '.',
        stack: { language: 'typescript', packageManager: 'pnpm' },
        structure: {},
        conventions: {},
      },
    ],
  };

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-files-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('skips .next directory', () => {
    const nextDir = path.join(tmpDir, '.next', 'cache');
    fs.mkdirSync(nextDir, { recursive: true });
    fs.writeFileSync(path.join(nextDir, 'page.ts'), '');
    fs.writeFileSync(path.join(tmpDir, 'app.ts'), '');

    const files = getAllSourceFiles(tmpDir, baseConfig);
    expect(files).toEqual(['app.ts']);
  });

  it('skips .expo directory', () => {
    const expoDir = path.join(tmpDir, '.expo');
    fs.mkdirSync(expoDir, { recursive: true });
    fs.writeFileSync(path.join(expoDir, 'settings.ts'), '');
    fs.writeFileSync(path.join(tmpDir, 'index.ts'), '');

    const files = getAllSourceFiles(tmpDir, baseConfig);
    expect(files).toEqual(['index.ts']);
  });

  it('skips build directory', () => {
    const buildDir = path.join(tmpDir, 'build');
    fs.mkdirSync(buildDir, { recursive: true });
    fs.writeFileSync(path.join(buildDir, 'output.js'), '');
    fs.writeFileSync(path.join(tmpDir, 'main.ts'), '');

    const files = getAllSourceFiles(tmpDir, baseConfig);
    expect(files).toEqual(['main.ts']);
  });

  it('skips coverage directory', () => {
    const covDir = path.join(tmpDir, 'coverage');
    fs.mkdirSync(covDir, { recursive: true });
    fs.writeFileSync(path.join(covDir, 'lcov.js'), '');
    fs.writeFileSync(path.join(tmpDir, 'src.ts'), '');

    const files = getAllSourceFiles(tmpDir, baseConfig);
    expect(files).toEqual(['src.ts']);
  });
});
