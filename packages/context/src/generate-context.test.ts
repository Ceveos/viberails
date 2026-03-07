import type { ViberailsConfig } from '@viberails/types';
import { describe, expect, it } from 'vitest';
import { generateContext } from './generate-context.js';

function makeConfig(overrides: Partial<ViberailsConfig> = {}): ViberailsConfig {
  return {
    version: 1,
    name: 'test-app',
    enforcement: 'warn',
    stack: { language: 'typescript', packageManager: 'pnpm' },
    structure: { srcDir: 'src', testPattern: '*.test.ts', tests: '__tests__' },
    conventions: {
      fileNaming: { value: 'kebab-case', _confidence: 'high', _consistency: 97 },
    },
    rules: {
      maxFileLines: 300,
      maxFunctionLines: 50,
      requireTests: true,
      enforceNaming: true,
      enforceBoundaries: false,
    },
    ignore: [],
    ...overrides,
  };
}

describe('generateContext (rules-focused)', () => {
  it('contains the enforced rules heading', () => {
    const output = generateContext(makeConfig());
    expect(output).toContain('# viberails enforced rules');
  });

  it('mentions file size limit', () => {
    const output = generateContext(makeConfig());
    expect(output).toContain('300 lines');
  });

  it('mentions function size limit', () => {
    const output = generateContext(makeConfig());
    expect(output).toContain('50 lines');
  });

  it('mentions naming convention with example', () => {
    const output = generateContext(makeConfig());
    expect(output).toContain('kebab-case');
    expect(output).toContain('user-profile.ts');
  });

  it('mentions test requirement', () => {
    const output = generateContext(makeConfig());
    expect(output).toContain('*.test.ts');
    expect(output).toContain('src/');
  });

  it('says commits will be rejected in enforce mode', () => {
    const output = generateContext(makeConfig({ enforcement: 'enforce' }));
    expect(output).toContain('Commits will be rejected');
  });

  it('says violations will be warned in warn mode', () => {
    const output = generateContext(makeConfig({ enforcement: 'warn' }));
    expect(output).toContain('warned');
    expect(output).not.toContain('rejected');
  });

  it('does not describe the project stack or architecture', () => {
    const output = generateContext(makeConfig());
    expect(output).not.toContain('## Architecture');
    expect(output).not.toContain('TypeScript');
    expect(output).not.toContain('pnpm');
  });

  it('includes the check command reminder', () => {
    const output = generateContext(makeConfig());
    expect(output).toContain('viberails check');
  });

  it('handles missing conventions gracefully', () => {
    const output = generateContext(makeConfig({ conventions: {} }));
    expect(output).not.toContain('kebab-case');
    expect(output).toContain('300 lines');
  });

  it('shows no-rules message when all rules are disabled', () => {
    const output = generateContext(
      makeConfig({
        rules: {
          maxFileLines: 0,
          maxFunctionLines: 0,
          requireTests: false,
          enforceNaming: false,
          enforceBoundaries: false,
        },
        conventions: {},
      }),
    );
    expect(output).toContain('No rules configured');
  });

  it('handles string convention values', () => {
    const output = generateContext(makeConfig({ conventions: { fileNaming: 'camelCase' } }));
    expect(output).toContain('camelCase');
    expect(output).toContain('userProfile.ts');
  });

  it('includes boundary rules section when boundaries are configured', () => {
    const output = generateContext(
      makeConfig({
        rules: { ...makeConfig().rules, enforceBoundaries: true },
        boundaries: [
          { from: '@app/ui', to: '@app/api', allow: false, reason: 'UI should not depend on API' },
        ],
      }),
    );
    expect(output).toContain('## Boundary rules');
    expect(output).toContain('`@app/ui` must NOT import from `@app/api`');
    expect(output).toContain('UI should not depend on API');
  });

  it('omits boundary section when enforceBoundaries is false', () => {
    const output = generateContext(
      makeConfig({
        rules: { ...makeConfig().rules, enforceBoundaries: false },
        boundaries: [{ from: '@app/ui', to: '@app/api', allow: false }],
      }),
    );
    expect(output).not.toContain('Boundary rules');
  });

  it('omits boundary section when only allow rules exist', () => {
    const output = generateContext(
      makeConfig({
        rules: { ...makeConfig().rules, enforceBoundaries: true },
        boundaries: [{ from: '@app/ui', to: '@app/shared', allow: true }],
      }),
    );
    expect(output).not.toContain('Boundary rules');
  });

  it('handles boundary rule without reason', () => {
    const output = generateContext(
      makeConfig({
        rules: { ...makeConfig().rules, enforceBoundaries: true },
        boundaries: [{ from: 'components', to: 'pages', allow: false }],
      }),
    );
    expect(output).toContain('`components` must NOT import from `pages`');
    expect(output).not.toContain('(');
  });
});

describe('per-package rules', () => {
  it('omits per-package section when no package overrides', () => {
    const result = generateContext(makeConfig());
    expect(result).not.toContain('Per-package rules');
  });

  it('does not include per-package section for empty overrides array', () => {
    const result = generateContext(makeConfig({ packages: [] }));
    expect(result).not.toContain('Per-package rules');
  });

  it('includes per-package section with convention override', () => {
    const result = generateContext(
      makeConfig({
        packages: [
          {
            name: '@app/mobile',
            path: 'apps/mobile',
            stack: { framework: 'expo@53' },
            conventions: { fileNaming: 'PascalCase' },
          },
        ],
      }),
    );
    expect(result).toContain('## Per-package rules');
    expect(result).toContain('### apps/mobile (expo)');
    expect(result).toContain('**PascalCase**');
  });

  it('shows package header without framework when stack is absent', () => {
    const result = generateContext(
      makeConfig({
        packages: [
          {
            name: '@app/shared',
            path: 'packages/shared',
            conventions: { fileNaming: 'camelCase' },
          },
        ],
      }),
    );
    expect(result).toContain('### packages/shared');
    expect(result).not.toContain('(');
  });

  it('includes rule overrides for maxFileLines and maxFunctionLines', () => {
    const result = generateContext(
      makeConfig({
        packages: [
          {
            name: '@app/web',
            path: 'apps/web',
            rules: { maxFileLines: 200, maxFunctionLines: 30 },
          },
        ],
      }),
    );
    expect(result).toContain('**200 lines**');
    expect(result).toContain('**30 lines**');
  });

  it('includes all convention overrides, not just fileNaming', () => {
    const result = generateContext(
      makeConfig({
        packages: [
          {
            name: '@app/mobile',
            path: 'apps/mobile',
            conventions: {
              fileNaming: 'PascalCase',
              componentNaming: 'PascalCase',
              hookNaming: 'useXxx',
              importAlias: '~/*',
            },
          },
        ],
      }),
    );
    expect(result).toContain('**PascalCase**');
    expect(result).toContain('Components use **PascalCase** naming');
    expect(result).toContain('Hooks use **useXxx** naming');
    expect(result).toContain('Import alias: `~/*`');
  });
});

describe('development setup section', () => {
  it('includes setup section when formatter is configured', () => {
    const output = generateContext(
      makeConfig({
        stack: {
          language: 'typescript',
          packageManager: 'pnpm',
          formatter: 'biome@2',
          linter: 'biome@2',
        },
      }),
    );
    expect(output).toContain('## Development setup');
    expect(output).toContain('**Biome** for formatting and linting');
    expect(output).toContain('format-on-save');
  });

  it('shows separate tools when formatter and linter differ', () => {
    const output = generateContext(
      makeConfig({
        stack: {
          language: 'typescript',
          packageManager: 'pnpm',
          formatter: 'prettier@3',
          linter: 'eslint@9',
        },
      }),
    );
    expect(output).toContain('**Prettier** for formatting');
    expect(output).toContain('**ESLint** for linting');
  });

  it('omits setup section when no linter or formatter', () => {
    const output = generateContext(
      makeConfig({ stack: { language: 'typescript', packageManager: 'pnpm' } }),
    );
    expect(output).not.toContain('Development setup');
  });

  it('includes linter-only section when no formatter', () => {
    const output = generateContext(
      makeConfig({ stack: { language: 'typescript', packageManager: 'pnpm', linter: 'eslint@9' } }),
    );
    expect(output).toContain('## Development setup');
    expect(output).toContain('**ESLint** for linting');
  });

  it('recommends Biome VS Code extension for Biome formatter', () => {
    const output = generateContext(
      makeConfig({
        stack: { language: 'typescript', packageManager: 'pnpm', formatter: 'biome@2' },
      }),
    );
    expect(output).toContain('Biome extension');
  });

  it('recommends Prettier VS Code extension for Prettier formatter', () => {
    const output = generateContext(
      makeConfig({
        stack: { language: 'typescript', packageManager: 'pnpm', formatter: 'prettier@3' },
      }),
    );
    expect(output).toContain('Prettier extension');
  });
});

describe('flat project handling', () => {
  it('omits srcDir from test requirement when project has no srcDir', () => {
    const output = generateContext(
      makeConfig({
        structure: { testPattern: '*.test.ts' },
      }),
    );
    expect(output).toContain('Every source file must have a corresponding');
    expect(output).not.toContain('src/');
  });

  it('includes srcDir in test requirement when present', () => {
    const output = generateContext(makeConfig());
    expect(output).toContain('src/');
  });
});
