import { describe, expect, it } from 'vitest';
import { classifyDirectory } from './classify-directory.js';
import type { WalkedDirectory } from './walk-directory.js';

function makeDir(overrides: Partial<WalkedDirectory>): WalkedDirectory {
  return {
    relativePath: overrides.relativePath ?? 'some-dir',
    absolutePath: overrides.absolutePath ?? '/project/some-dir',
    sourceFileCount: overrides.sourceFileCount ?? 0,
    sourceFileNames: overrides.sourceFileNames ?? [],
    depth: overrides.depth ?? 1,
  };
}

describe('classifyDirectory', () => {
  describe('name-based classification', () => {
    it('classifies src/app as pages', () => {
      const result = classifyDirectory(
        makeDir({
          relativePath: 'src/app',
          sourceFileCount: 5,
          sourceFileNames: ['page.tsx', 'layout.tsx', 'loading.tsx', 'error.tsx', 'not-found.tsx'],
        }),
      );
      expect(result).not.toBeNull();
      expect(result?.role).toBe('pages');
    });

    it('classifies src/pages as pages', () => {
      const result = classifyDirectory(
        makeDir({
          relativePath: 'src/pages',
          sourceFileCount: 3,
          sourceFileNames: ['index.tsx', 'about.tsx', 'contact.tsx'],
        }),
      );
      expect(result?.role).toBe('pages');
    });

    it('classifies src/components as components', () => {
      const result = classifyDirectory(
        makeDir({
          relativePath: 'src/components',
          sourceFileCount: 10,
          sourceFileNames: ['Button.tsx'],
        }),
      );
      expect(result?.role).toBe('components');
    });

    it('classifies components as components', () => {
      const result = classifyDirectory(
        makeDir({
          relativePath: 'components',
          sourceFileCount: 5,
          sourceFileNames: ['Header.tsx'],
        }),
      );
      expect(result?.role).toBe('components');
    });

    it('classifies src/hooks as hooks', () => {
      const result = classifyDirectory(
        makeDir({
          relativePath: 'src/hooks',
          sourceFileCount: 3,
          sourceFileNames: ['use-auth.ts'],
        }),
      );
      expect(result?.role).toBe('hooks');
    });

    it('classifies src/lib as utils', () => {
      const result = classifyDirectory(
        makeDir({ relativePath: 'src/lib', sourceFileCount: 5, sourceFileNames: ['helpers.ts'] }),
      );
      expect(result?.role).toBe('utils');
    });

    it('classifies src/utils as utils', () => {
      const result = classifyDirectory(
        makeDir({
          relativePath: 'src/utils',
          sourceFileCount: 2,
          sourceFileNames: ['format.ts', 'parse.ts'],
        }),
      );
      expect(result?.role).toBe('utils');
    });

    it('classifies src/types as types', () => {
      const result = classifyDirectory(
        makeDir({ relativePath: 'src/types', sourceFileCount: 3, sourceFileNames: ['user.ts'] }),
      );
      expect(result?.role).toBe('types');
    });

    it('classifies __tests__ as tests', () => {
      const result = classifyDirectory(
        makeDir({
          relativePath: '__tests__',
          sourceFileCount: 8,
          sourceFileNames: ['app.test.ts'],
        }),
      );
      expect(result?.role).toBe('tests');
    });

    it('classifies src/styles as styles', () => {
      const result = classifyDirectory(
        makeDir({ relativePath: 'src/styles', sourceFileCount: 1, sourceFileNames: ['theme.ts'] }),
      );
      expect(result?.role).toBe('styles');
    });

    it('classifies src/api as api', () => {
      const result = classifyDirectory(
        makeDir({ relativePath: 'src/api', sourceFileCount: 4, sourceFileNames: ['users.ts'] }),
      );
      expect(result?.role).toBe('api');
    });

    it('classifies src/app/api as api', () => {
      const result = classifyDirectory(
        makeDir({ relativePath: 'src/app/api', sourceFileCount: 3, sourceFileNames: ['route.ts'] }),
      );
      expect(result?.role).toBe('api');
    });

    it('classifies config as config', () => {
      const result = classifyDirectory(
        makeDir({
          relativePath: 'config',
          sourceFileCount: 2,
          sourceFileNames: ['database.ts', 'auth.ts'],
        }),
      );
      expect(result?.role).toBe('config');
    });
  });

  describe('confidence based on file count', () => {
    it('returns high confidence for name-matched directory with source files', () => {
      const result = classifyDirectory(
        makeDir({
          relativePath: 'src/components',
          sourceFileCount: 5,
          sourceFileNames: ['A.tsx', 'B.tsx', 'C.tsx', 'D.tsx', 'E.tsx'],
        }),
      );
      expect(result?.confidence).toBe('high');
    });

    it('returns low confidence for name-matched directory with no source files', () => {
      const result = classifyDirectory(
        makeDir({ relativePath: 'src/components', sourceFileCount: 0, sourceFileNames: [] }),
      );
      expect(result?.confidence).toBe('low');
    });
  });

  describe('content-based heuristics', () => {
    it('infers hooks from use-prefixed files at high ratio', () => {
      const result = classifyDirectory(
        makeDir({
          relativePath: 'src/custom',
          sourceFileCount: 4,
          sourceFileNames: ['useAuth.ts', 'useProfile.ts', 'useSettings.ts', 'useTheme.ts'],
        }),
      );
      expect(result?.role).toBe('hooks');
      expect(result?.confidence).toBe('high');
    });

    it('infers hooks at medium confidence when ratio is 50-89%', () => {
      const result = classifyDirectory(
        makeDir({
          relativePath: 'src/custom',
          sourceFileCount: 4,
          sourceFileNames: ['useAuth.ts', 'useProfile.ts', 'helpers.ts', 'constants.ts'],
        }),
      );
      expect(result?.role).toBe('hooks');
      expect(result?.confidence).toBe('medium');
    });

    it('infers tests from test file names at high ratio', () => {
      const result = classifyDirectory(
        makeDir({
          relativePath: 'src/spec',
          sourceFileCount: 5,
          sourceFileNames: [
            'auth.test.ts',
            'user.test.ts',
            'api.test.ts',
            'utils.test.ts',
            'db.spec.ts',
          ],
        }),
      );
      expect(result?.role).toBe('tests');
      expect(result?.confidence).toBe('high');
    });

    it('infers tests at medium confidence when ratio is 50-89%', () => {
      const result = classifyDirectory(
        makeDir({
          relativePath: 'src/spec',
          sourceFileCount: 4,
          sourceFileNames: ['auth.test.ts', 'user.test.ts', 'helpers.ts', 'fixtures.ts'],
        }),
      );
      expect(result?.role).toBe('tests');
      expect(result?.confidence).toBe('medium');
    });
  });

  describe('monorepo suffix matching', () => {
    it('classifies apps/web/lib as utils via suffix match', () => {
      const result = classifyDirectory(
        makeDir({
          relativePath: 'apps/web/lib',
          sourceFileCount: 3,
          sourceFileNames: ['api.ts', 'auth.ts', 'utils.ts'],
        }),
      );
      expect(result?.role).toBe('utils');
    });

    it('classifies apps/mobile/hooks as hooks via suffix match', () => {
      const result = classifyDirectory(
        makeDir({
          relativePath: 'apps/mobile/hooks',
          sourceFileCount: 5,
          sourceFileNames: [
            'useAuth.ts',
            'useTheme.ts',
            'useSettings.ts',
            'useProfile.ts',
            'useNav.ts',
          ],
        }),
      );
      expect(result?.role).toBe('hooks');
    });

    it('classifies apps/web/components as components via suffix match', () => {
      const result = classifyDirectory(
        makeDir({
          relativePath: 'apps/web/components',
          sourceFileCount: 4,
          sourceFileNames: ['Button.tsx', 'Header.tsx', 'Footer.tsx', 'Layout.tsx'],
        }),
      );
      expect(result?.role).toBe('components');
    });

    it('classifies apps/web/app as pages via suffix match', () => {
      const result = classifyDirectory(
        makeDir({
          relativePath: 'apps/web/app',
          sourceFileCount: 3,
          sourceFileNames: ['page.tsx', 'layout.tsx', 'loading.tsx'],
        }),
      );
      expect(result?.role).toBe('pages');
    });

    it('classifies packages/db/src/__tests__ as tests via suffix match', () => {
      const result = classifyDirectory(
        makeDir({
          relativePath: 'packages/db/src/__tests__',
          sourceFileCount: 12,
          sourceFileNames: ['user.test.ts', 'post.test.ts', 'auth.test.ts'],
        }),
      );
      expect(result?.role).toBe('tests');
    });

    it('classifies apps/web/src/styles as styles via suffix match', () => {
      const result = classifyDirectory(
        makeDir({
          relativePath: 'apps/web/src/styles',
          sourceFileCount: 2,
          sourceFileNames: ['theme.ts', 'globals.ts'],
        }),
      );
      expect(result?.role).toBe('styles');
    });

    it('classifies apps/web/app/api as api via suffix match on multi-segment pattern', () => {
      const result = classifyDirectory(
        makeDir({
          relativePath: 'apps/web/app/api',
          sourceFileCount: 3,
          sourceFileNames: ['route.ts', 'webhook.ts', 'auth.ts'],
        }),
      );
      expect(result?.role).toBe('api');
    });

    it('classifies apps/web/src/utils as utils via suffix match on multi-segment pattern', () => {
      const result = classifyDirectory(
        makeDir({
          relativePath: 'apps/web/src/utils',
          sourceFileCount: 2,
          sourceFileNames: ['format.ts', 'parse.ts'],
        }),
      );
      expect(result?.role).toBe('utils');
    });
  });

  describe('content-based minimum file count', () => {
    it('does NOT classify a directory with 1 hook file as hooks', () => {
      const result = classifyDirectory(
        makeDir({
          relativePath: 'src/custom',
          sourceFileCount: 1,
          sourceFileNames: ['useAuth.ts'],
        }),
      );
      expect(result?.role).not.toBe('hooks');
    });

    it('does NOT classify a directory with 1 test file as tests', () => {
      const result = classifyDirectory(
        makeDir({
          relativePath: 'src/custom',
          sourceFileCount: 1,
          sourceFileNames: ['auth.test.ts'],
        }),
      );
      expect(result?.role).not.toBe('tests');
    });

    it('classifies directory with 2 hook files as hooks', () => {
      const result = classifyDirectory(
        makeDir({
          relativePath: 'src/custom',
          sourceFileCount: 2,
          sourceFileNames: ['useAuth.ts', 'useTheme.ts'],
        }),
      );
      expect(result?.role).toBe('hooks');
    });

    it('classifies directory with 2 test files as tests', () => {
      const result = classifyDirectory(
        makeDir({
          relativePath: 'src/custom',
          sourceFileCount: 2,
          sourceFileNames: ['auth.test.ts', 'user.test.ts'],
        }),
      );
      expect(result?.role).toBe('tests');
    });

    it('name match takes priority over content heuristics for lib with one hook', () => {
      const result = classifyDirectory(
        makeDir({
          relativePath: 'apps/web/lib',
          sourceFileCount: 1,
          sourceFileNames: ['useApi.ts'],
        }),
      );
      expect(result?.role).toBe('utils');
    });
  });

  describe('null and unknown returns', () => {
    it('returns null for directory with no source files and no name match', () => {
      const result = classifyDirectory(
        makeDir({
          relativePath: 'random-dir',
          sourceFileCount: 0,
          sourceFileNames: [],
        }),
      );
      expect(result).toBeNull();
    });

    it('returns unknown for directory with source files but no classification', () => {
      const result = classifyDirectory(
        makeDir({
          relativePath: 'random-dir',
          sourceFileCount: 3,
          sourceFileNames: ['foo.ts', 'bar.ts', 'baz.ts'],
        }),
      );
      expect(result?.role).toBe('unknown');
      expect(result?.confidence).toBe('low');
    });
  });
});
