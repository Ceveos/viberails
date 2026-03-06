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
});
