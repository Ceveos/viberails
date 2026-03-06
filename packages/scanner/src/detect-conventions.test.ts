import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DetectedStructure } from '@viberails/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { detectConventions } from './detect-conventions.js';
import { detectStructure } from './detect-structure.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const fixturesDir = resolve(__dirname, '../../../tests/fixtures');

describe('detectConventions', () => {
  describe('fileNaming detection', () => {
    it('detects kebab-case with high confidence for nextjs-15 fixture', async () => {
      const fixturePath = join(fixturesDir, 'nextjs-15');
      const structure = await detectStructure(fixturePath);
      const conventions = await detectConventions(fixturePath, structure);

      expect(conventions.fileNaming).toBeDefined();
      expect(conventions.fileNaming.value).toBe('kebab-case');
      expect(conventions.fileNaming.confidence).toBe('high');
    });

    it('detects kebab-case with medium confidence for mixed-conventions fixture', async () => {
      const fixturePath = join(fixturesDir, 'mixed-conventions');
      const structure = await detectStructure(fixturePath);
      const conventions = await detectConventions(fixturePath, structure);

      expect(conventions.fileNaming).toBeDefined();
      expect(conventions.fileNaming.value).toBe('kebab-case');
      expect(conventions.fileNaming.confidence).toBe('medium');
      expect(conventions.fileNaming.consistency).toBe(75);
    });

    it('omits fileNaming when conventions are inconsistent', async () => {
      const fixturePath = join(fixturesDir, 'inconsistent');
      const structure = await detectStructure(fixturePath);
      const conventions = await detectConventions(fixturePath, structure);

      expect(conventions.fileNaming).toBeUndefined();
    });
  });

  describe('fileNaming with high confidence', () => {
    let tempDir: string;

    beforeAll(async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'viberails-conventions-'));
      const srcDir = join(tempDir, 'src', 'components');
      await mkdir(srcDir, { recursive: true });
      // All kebab-case: 5 unambiguous files
      for (const name of ['user-profile', 'data-table', 'nav-bar', 'auth-form', 'sidebar-menu']) {
        await writeFile(join(srcDir, `${name}.tsx`), `export function X() { return null; }`);
      }
    });

    afterAll(async () => {
      await rm(tempDir, { recursive: true, force: true });
    });

    it('detects kebab-case with high confidence when all files match', async () => {
      const structure = await detectStructure(tempDir);
      const conventions = await detectConventions(tempDir, structure);

      expect(conventions.fileNaming).toBeDefined();
      expect(conventions.fileNaming.value).toBe('kebab-case');
      expect(conventions.fileNaming.confidence).toBe('high');
      expect(conventions.fileNaming.consistency).toBe(100);
      expect(conventions.fileNaming.sampleSize).toBe(5);
    });
  });

  describe('componentNaming detection', () => {
    let tempDir: string;

    beforeAll(async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'viberails-components-'));
      const compDir = join(tempDir, 'src', 'components');
      await mkdir(compDir, { recursive: true });
      for (const name of ['Button', 'Modal', 'NavBar']) {
        await writeFile(join(compDir, `${name}.tsx`), `export function ${name}() { return null; }`);
      }
    });

    afterAll(async () => {
      await rm(tempDir, { recursive: true, force: true });
    });

    it('detects PascalCase component naming with high confidence', async () => {
      const structure = await detectStructure(tempDir);
      const conventions = await detectConventions(tempDir, structure);

      expect(conventions.componentNaming).toBeDefined();
      expect(conventions.componentNaming.value).toBe('PascalCase');
      expect(conventions.componentNaming.confidence).toBe('high');
      expect(conventions.componentNaming.consistency).toBe(100);
    });
  });

  describe('componentNaming with insufficient files', () => {
    let tempDir: string;

    beforeAll(async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'viberails-few-comp-'));
      const compDir = join(tempDir, 'src', 'components');
      await mkdir(compDir, { recursive: true });
      await writeFile(join(compDir, 'Button.tsx'), `export function Button() { return null; }`);
      await writeFile(join(compDir, 'Modal.tsx'), `export function Modal() { return null; }`);
    });

    afterAll(async () => {
      await rm(tempDir, { recursive: true, force: true });
    });

    it('omits componentNaming when fewer than 3 tsx files exist', async () => {
      const structure = await detectStructure(tempDir);
      const conventions = await detectConventions(tempDir, structure);

      expect(conventions.componentNaming).toBeUndefined();
    });
  });

  describe('hookNaming detection', () => {
    it('detects kebab-case hook naming in nextjs-15 fixture', async () => {
      const fixturePath = join(fixturesDir, 'nextjs-15');
      const structure = await detectStructure(fixturePath);
      const conventions = await detectConventions(fixturePath, structure);

      expect(conventions.hookNaming).toBeDefined();
      expect(conventions.hookNaming.value).toBe('use-*');
      expect(conventions.hookNaming.confidence).toBe('high');
      expect(conventions.hookNaming.consistency).toBe(100);
    });

    describe('camelCase hooks', () => {
      let tempDir: string;

      beforeAll(async () => {
        tempDir = await mkdtemp(join(tmpdir(), 'viberails-camel-hooks-'));
        const hooksDir = join(tempDir, 'hooks');
        await mkdir(hooksDir, { recursive: true });
        for (const name of ['useAuth', 'useForm', 'useTheme']) {
          await writeFile(join(hooksDir, `${name}.ts`), `export function ${name}() {}`);
        }
      });

      afterAll(async () => {
        await rm(tempDir, { recursive: true, force: true });
      });

      it('detects camelCase hook naming', async () => {
        const structure = await detectStructure(tempDir);
        const conventions = await detectConventions(tempDir, structure);

        expect(conventions.hookNaming).toBeDefined();
        expect(conventions.hookNaming.value).toBe('useXxx');
        expect(conventions.hookNaming.confidence).toBe('high');
      });
    });

    describe('insufficient hook files', () => {
      let tempDir: string;

      beforeAll(async () => {
        tempDir = await mkdtemp(join(tmpdir(), 'viberails-few-hooks-'));
        const hooksDir = join(tempDir, 'hooks');
        await mkdir(hooksDir, { recursive: true });
        await writeFile(join(hooksDir, 'use-auth.ts'), `export function useAuth() {}`);
        await writeFile(join(hooksDir, 'use-form.ts'), `export function useForm() {}`);
      });

      afterAll(async () => {
        await rm(tempDir, { recursive: true, force: true });
      });

      it('omits hookNaming when fewer than 3 hook files exist', async () => {
        const structure = await detectStructure(tempDir);
        const conventions = await detectConventions(tempDir, structure);

        expect(conventions.hookNaming).toBeUndefined();
      });
    });
  });

  describe('importAlias detection', () => {
    it('detects import alias from tsconfig.json paths in nextjs-15 fixture', async () => {
      const fixturePath = join(fixturesDir, 'nextjs-15');
      const structure = await detectStructure(fixturePath);
      const conventions = await detectConventions(fixturePath, structure);

      expect(conventions.importAlias).toBeDefined();
      expect(conventions.importAlias.value).toBe('@/*');
      expect(conventions.importAlias.confidence).toBe('high');
    });

    describe('tsconfig with no paths', () => {
      let tempDir: string;

      beforeAll(async () => {
        tempDir = await mkdtemp(join(tmpdir(), 'viberails-no-alias-'));
        await writeFile(join(tempDir, 'tsconfig.json'), JSON.stringify({ compilerOptions: {} }));
      });

      afterAll(async () => {
        await rm(tempDir, { recursive: true, force: true });
      });

      it('omits importAlias when tsconfig has no paths', async () => {
        const structure: DetectedStructure = { directories: [] };
        const conventions = await detectConventions(tempDir, structure);

        expect(conventions.importAlias).toBeUndefined();
      });
    });

    it('omits importAlias when no tsconfig.json exists', async () => {
      const fixturePath = join(fixturesDir, 'empty');
      const structure: DetectedStructure = { directories: [] };
      const conventions = await detectConventions(fixturePath, structure);

      expect(conventions.importAlias).toBeUndefined();
    });
  });

  describe('graceful degradation', () => {
    it('returns empty result for empty project', async () => {
      const fixturePath = join(fixturesDir, 'empty');
      const structure = await detectStructure(fixturePath);
      const conventions = await detectConventions(fixturePath, structure);

      expect(conventions).toEqual({});
    });

    it('returns empty result for project with no package.json', async () => {
      const fixturePath = join(fixturesDir, 'no-package-json');
      const structure = await detectStructure(fixturePath);
      const conventions = await detectConventions(fixturePath, structure);

      expect(conventions).toEqual({});
    });
  });
});
