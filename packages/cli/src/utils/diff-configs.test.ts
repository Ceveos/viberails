import type { CodebaseStatistics, ViberailsConfig } from '@viberails/types';
import { describe, expect, it } from 'vitest';
import { diffConfigs, formatStatsDelta } from './diff-configs.js';

function makeConfig(overrides: Partial<ViberailsConfig> = {}): ViberailsConfig {
  return {
    version: 2,
    name: 'test',
    enforcement: 'warn',
    rules: {
      maxFileLines: 300,
      maxTestFileLines: 0,
      requireTests: false,
      enforceNaming: false,
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
    ...overrides,
  };
}

describe('diffConfigs', () => {
  it('returns empty array when configs are identical', () => {
    const config = makeConfig();
    expect(diffConfigs(config, config)).toEqual([]);
  });

  it('detects new stack field addition', () => {
    const existing = makeConfig();
    const merged = makeConfig({
      packages: [
        {
          name: 'test',
          path: '.',
          stack: { language: 'typescript', packageManager: 'pnpm', styling: 'tailwindcss@4' },
          structure: {},
          conventions: {},
        },
      ],
    });
    const changes = diffConfigs(existing, merged);
    expect(changes).toEqual([{ type: 'added', description: 'Stack: added Tailwind CSS 4' }]);
  });

  it('detects stack field value change', () => {
    const existing = makeConfig({
      packages: [
        {
          name: 'test',
          path: '.',
          stack: { language: 'typescript', packageManager: 'pnpm', framework: 'nextjs@14' },
          structure: {},
          conventions: {},
        },
      ],
    });
    const merged = makeConfig({
      packages: [
        {
          name: 'test',
          path: '.',
          stack: { language: 'typescript', packageManager: 'pnpm', framework: 'nextjs@15' },
          structure: {},
          conventions: {},
        },
      ],
    });
    const changes = diffConfigs(existing, merged);
    expect(changes).toEqual([{ type: 'changed', description: 'Stack: Next.js 14 → Next.js 15' }]);
  });

  it('detects new convention with _meta detected flag', () => {
    const existing = makeConfig();
    const merged = makeConfig({
      packages: [
        {
          name: 'test',
          path: '.',
          stack: { language: 'typescript', packageManager: 'pnpm' },
          structure: {},
          conventions: { hookNaming: 'use-*' },
        },
      ],
      _meta: {
        packages: {
          '.': {
            conventions: {
              hookNaming: { value: 'use-*', confidence: 'high', consistency: 95, detected: true },
            },
          },
        },
      },
    });
    const changes = diffConfigs(existing, merged);
    expect(changes).toEqual([
      { type: 'added', description: 'New convention: Hook naming (use-*)' },
    ]);
  });

  it('detects new convention as plain string', () => {
    const existing = makeConfig();
    const merged = makeConfig({
      packages: [
        {
          name: 'test',
          path: '.',
          stack: { language: 'typescript', packageManager: 'pnpm' },
          structure: {},
          conventions: { fileNaming: 'kebab-case' },
        },
      ],
    });
    const changes = diffConfigs(existing, merged);
    expect(changes).toEqual([
      { type: 'added', description: 'New convention: File naming (kebab-case)' },
    ]);
  });

  it('ignores conventions that already existed', () => {
    const config = makeConfig({
      packages: [
        {
          name: 'test',
          path: '.',
          stack: { language: 'typescript', packageManager: 'pnpm' },
          structure: {},
          conventions: { fileNaming: 'kebab-case' },
        },
      ],
    });
    expect(diffConfigs(config, config)).toEqual([]);
  });

  it('detects new package added', () => {
    const existing = makeConfig({
      packages: [
        {
          name: 'test',
          path: '.',
          stack: { language: 'typescript', packageManager: 'pnpm' },
          structure: {},
          conventions: {},
        },
        { name: 'web', path: 'packages/web' },
      ],
    });
    const merged = makeConfig({
      packages: [
        {
          name: 'test',
          path: '.',
          stack: { language: 'typescript', packageManager: 'pnpm' },
          structure: {},
          conventions: {},
        },
        { name: 'web', path: 'packages/web' },
        { name: 'auth', path: 'packages/auth' },
      ],
    });
    const changes = diffConfigs(existing, merged);
    expect(changes).toEqual([{ type: 'added', description: 'New package: packages/auth' }]);
  });

  it('detects new structure field', () => {
    const existing = makeConfig();
    const merged = makeConfig({
      packages: [
        {
          name: 'test',
          path: '.',
          stack: { language: 'typescript', packageManager: 'pnpm' },
          structure: { hooks: 'src/hooks' },
          conventions: {},
        },
      ],
    });
    const changes = diffConfigs(existing, merged);
    expect(changes).toEqual([
      { type: 'added', description: 'Structure: detected hooks directory (src/hooks)' },
    ]);
  });
});

describe('formatStatsDelta', () => {
  const base: CodebaseStatistics = {
    totalFiles: 100,
    totalLines: 5000,
    averageFileLines: 50,
    largestFiles: [],
    filesByExtension: {},
  };

  it('returns undefined when no change', () => {
    expect(formatStatsDelta(base, base)).toBeUndefined();
  });

  it('formats positive deltas', () => {
    const newStats = { ...base, totalFiles: 145, totalLines: 8200 };
    expect(formatStatsDelta(base, newStats)).toBe('+45 files, +3,200 lines since last sync');
  });

  it('formats negative deltas', () => {
    const newStats = { ...base, totalFiles: 88, totalLines: 4000 };
    expect(formatStatsDelta(base, newStats)).toBe('-12 files, -1,000 lines since last sync');
  });

  it('formats file-only change', () => {
    const newStats = { ...base, totalFiles: 110 };
    expect(formatStatsDelta(base, newStats)).toBe('+10 files since last sync');
  });

  it('formats line-only change', () => {
    const newStats = { ...base, totalLines: 5500 };
    expect(formatStatsDelta(base, newStats)).toBe('+500 lines since last sync');
  });
});
