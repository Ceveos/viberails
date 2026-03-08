import type { ViberailsConfig } from '@viberails/types';
import { describe, expect, it } from 'vitest';
import {
  formatBoundaryRules,
  formatDevelopmentSetup,
  formatPackageOverrides,
  getRootPackage,
  packageHeader,
} from './format-helpers.js';

function makeConfig(overrides: Partial<ViberailsConfig> = {}): ViberailsConfig {
  return {
    version: 1,
    name: 'test-app',
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
        name: 'test-app',
        path: '.',
        stack: { language: 'typescript', packageManager: 'pnpm' },
        structure: {},
        conventions: {},
      },
    ],
    ...overrides,
  };
}

describe('getRootPackage', () => {
  it('returns the package with path "."', () => {
    const config = makeConfig();
    const root = getRootPackage(config);
    expect(root.path).toBe('.');
  });

  it('falls back to first package when no root package', () => {
    const config = makeConfig({
      packages: [
        {
          name: 'sub',
          path: 'packages/sub',
          stack: { language: 'typescript', packageManager: 'pnpm' },
        },
      ],
    });
    const root = getRootPackage(config);
    expect(root.path).toBe('packages/sub');
  });
});

describe('formatDevelopmentSetup', () => {
  it('returns empty for no linter or formatter', () => {
    const config = makeConfig();
    expect(formatDevelopmentSetup(config)).toEqual([]);
  });

  it('handles Biome as both formatter and linter', () => {
    const config = makeConfig({
      packages: [
        {
          name: 'test-app',
          path: '.',
          stack: {
            language: 'typescript',
            packageManager: 'pnpm',
            formatter: 'biome',
            linter: 'biome',
          },
          structure: {},
          conventions: {},
        },
      ],
    });
    const lines = formatDevelopmentSetup(config);
    expect(lines).toContain('This project uses **Biome** for formatting and linting.\n');
    expect(lines.some((l) => l.includes('Biome extension'))).toBe(true);
  });

  it('handles separate Prettier formatter and ESLint linter', () => {
    const config = makeConfig({
      packages: [
        {
          name: 'test-app',
          path: '.',
          stack: {
            language: 'typescript',
            packageManager: 'pnpm',
            formatter: 'prettier',
            linter: 'eslint',
          },
          structure: {},
          conventions: {},
        },
      ],
    });
    const lines = formatDevelopmentSetup(config);
    expect(lines).toContain(
      'This project uses **Prettier** for formatting and **ESLint** for linting.\n',
    );
    expect(lines.some((l) => l.includes('Prettier extension'))).toBe(true);
  });

  it('handles formatter only', () => {
    const config = makeConfig({
      packages: [
        {
          name: 'test-app',
          path: '.',
          stack: { language: 'typescript', packageManager: 'pnpm', formatter: 'prettier' },
          structure: {},
          conventions: {},
        },
      ],
    });
    const lines = formatDevelopmentSetup(config);
    expect(lines).toContain('This project uses **Prettier** for formatting.\n');
  });
});

describe('formatBoundaryRules', () => {
  it('returns empty when boundaries disabled', () => {
    const config = makeConfig({
      boundaries: { deny: { '@app/a': ['@app/b'] } },
    });
    expect(formatBoundaryRules(config)).toEqual([]);
  });

  it('returns empty when deny map is empty', () => {
    const config = makeConfig({
      rules: {
        maxFileLines: 300,
        maxTestFileLines: 0,
        testCoverage: 80,
        enforceNaming: true,
        enforceBoundaries: true,
      },
      boundaries: { deny: {} },
    });
    expect(formatBoundaryRules(config)).toEqual([]);
  });

  it('formats deny rules grouped by source', () => {
    const config = makeConfig({
      rules: {
        maxFileLines: 300,
        maxTestFileLines: 0,
        testCoverage: 80,
        enforceNaming: true,
        enforceBoundaries: true,
      },
      boundaries: { deny: { '@app/types': ['@app/db', '@app/api'] } },
    });
    const lines = formatBoundaryRules(config);
    expect(lines).toContain('## Boundary rules\n');
    expect(lines).toContain('- `@app/types` must NOT import from: `@app/db`, `@app/api`');
  });
});

describe('formatPackageOverrides', () => {
  it('returns empty when only root package', () => {
    const config = makeConfig();
    expect(formatPackageOverrides(config)).toEqual([]);
  });

  it('formats non-root package with file naming convention', () => {
    const config = makeConfig({
      packages: [
        {
          name: 'test-app',
          path: '.',
          stack: { language: 'typescript', packageManager: 'pnpm' },
          structure: {},
          conventions: {},
        },
        { name: '@app/web', path: 'apps/web', conventions: { fileNaming: 'PascalCase' } },
      ],
    });
    const lines = formatPackageOverrides(config);
    expect(lines).toContain('### apps/web');
    expect(lines.some((l) => l.includes('**PascalCase**'))).toBe(true);
  });
});

describe('packageHeader', () => {
  it('includes framework name when present', () => {
    const result = packageHeader({
      name: '@app/web',
      path: 'apps/web',
      stack: { framework: 'nextjs' },
    });
    expect(result).toBe('### apps/web (nextjs)');
  });
});
