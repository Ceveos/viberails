import type { ViberailsConfig } from '@viberails/types';
import { describe, expect, it } from 'vitest';
import {
  conventionValue,
  formatBoundaryRules,
  formatDevelopmentSetup,
  formatPackageOverrides,
  packageHeader,
} from './format-helpers.js';

function makeConfig(overrides: Partial<ViberailsConfig> = {}): ViberailsConfig {
  return {
    version: 1,
    name: 'test-app',
    enforcement: 'warn',
    stack: { language: 'typescript', packageManager: 'pnpm' },
    structure: {},
    conventions: {},
    rules: {
      maxFileLines: 300,
      maxTestFileLines: 0,
      maxFunctionLines: 50,
      requireTests: true,
      enforceNaming: true,
      enforceBoundaries: false,
    },
    ignore: [],
    ...overrides,
  };
}

describe('conventionValue', () => {
  it('extracts string from string input', () => {
    expect(conventionValue('kebab-case')).toBe('kebab-case');
  });

  it('extracts value from object input', () => {
    expect(conventionValue({ value: 'PascalCase', _confidence: 'high', _consistency: 95 })).toBe(
      'PascalCase',
    );
  });
});

describe('formatDevelopmentSetup', () => {
  it('returns empty for no linter or formatter', () => {
    const config = makeConfig();
    expect(formatDevelopmentSetup(config)).toEqual([]);
  });

  it('handles Biome as both formatter and linter', () => {
    const config = makeConfig({
      stack: {
        language: 'typescript',
        packageManager: 'pnpm',
        formatter: 'biome',
        linter: 'biome',
      },
    });
    const lines = formatDevelopmentSetup(config);
    expect(lines).toContain('This project uses **Biome** for formatting and linting.\n');
    expect(lines.some((l) => l.includes('Biome extension'))).toBe(true);
  });

  it('handles separate Prettier formatter and ESLint linter', () => {
    const config = makeConfig({
      stack: {
        language: 'typescript',
        packageManager: 'pnpm',
        formatter: 'prettier',
        linter: 'eslint',
      },
    });
    const lines = formatDevelopmentSetup(config);
    expect(lines).toContain(
      'This project uses **Prettier** for formatting and **ESLint** for linting.\n',
    );
    expect(lines.some((l) => l.includes('Prettier extension'))).toBe(true);
  });

  it('handles formatter only', () => {
    const config = makeConfig({
      stack: { language: 'typescript', packageManager: 'pnpm', formatter: 'prettier' },
    });
    const lines = formatDevelopmentSetup(config);
    expect(lines).toContain('This project uses **Prettier** for formatting.\n');
  });
});

describe('formatBoundaryRules', () => {
  it('returns empty when boundaries disabled', () => {
    const config = makeConfig({
      boundaries: [{ from: '@app/a', to: '@app/b', allow: false }],
    });
    expect(formatBoundaryRules(config)).toEqual([]);
  });

  it('returns empty when no deny rules', () => {
    const config = makeConfig({
      rules: {
        maxFileLines: 300,
        maxTestFileLines: 0,
        maxFunctionLines: 50,
        requireTests: true,
        enforceNaming: true,
        enforceBoundaries: true,
      },
      boundaries: [{ from: '@app/a', to: '@app/b', allow: true }],
    });
    expect(formatBoundaryRules(config)).toEqual([]);
  });

  it('formats deny rules with reasons', () => {
    const config = makeConfig({
      rules: {
        maxFileLines: 300,
        maxTestFileLines: 0,
        maxFunctionLines: 50,
        requireTests: true,
        enforceNaming: true,
        enforceBoundaries: true,
      },
      boundaries: [
        { from: '@app/types', to: '@app/db', allow: false, reason: 'types must stay pure' },
      ],
    });
    const lines = formatBoundaryRules(config);
    expect(lines).toContain('## Boundary rules\n');
    expect(lines).toContain('- `@app/types` must NOT import from `@app/db` (types must stay pure)');
  });
});

describe('formatPackageOverrides', () => {
  it('returns empty when no packages', () => {
    const config = makeConfig();
    expect(formatPackageOverrides(config)).toEqual([]);
  });

  it('formats package with file naming convention', () => {
    const config = makeConfig({
      packages: [{ name: '@app/web', path: 'apps/web', conventions: { fileNaming: 'PascalCase' } }],
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
