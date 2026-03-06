import type { ScanResult, ViberailsConfig } from '@viberails/types';
import { describe, expect, it } from 'vitest';
import { generateContext } from './generate-context.js';

function createNextjs15ScanResult(): ScanResult {
  return {
    root: '/home/user/projects/my-app',
    stack: {
      framework: { name: 'nextjs', version: '15' },
      language: { name: 'typescript' },
      styling: { name: 'tailwindcss', version: '4' },
      packageManager: { name: 'pnpm' },
      linter: { name: 'eslint', version: '9' },
      testRunner: { name: 'vitest' },
      libraries: [{ name: 'zod' }, { name: 'react-query', version: '5' }],
    },
    structure: {
      srcDir: 'src',
      directories: [
        { path: 'src/app', role: 'pages', fileCount: 12, confidence: 'high' },
        {
          path: 'src/components',
          role: 'components',
          fileCount: 47,
          confidence: 'high',
        },
        { path: 'src/hooks', role: 'hooks', fileCount: 8, confidence: 'high' },
        { path: 'src/lib', role: 'utils', fileCount: 14, confidence: 'high' },
        { path: 'src/types', role: 'types', fileCount: 5, confidence: 'high' },
        {
          path: '__tests__',
          role: 'tests',
          fileCount: 23,
          confidence: 'high',
        },
      ],
      testPattern: {
        value: '*.test.ts',
        confidence: 'high',
        sampleSize: 23,
        consistency: 95,
      },
    },
    conventions: {
      fileNaming: {
        value: 'kebab-case',
        confidence: 'high',
        sampleSize: 100,
        consistency: 97,
      },
      componentNaming: {
        value: 'PascalCase',
        confidence: 'high',
        sampleSize: 47,
        consistency: 94,
      },
      hookNaming: {
        value: 'useXxx',
        confidence: 'medium',
        sampleSize: 8,
        consistency: 78,
      },
      importAlias: {
        value: '@/*',
        confidence: 'high',
        sampleSize: 1,
        consistency: 100,
      },
    },
    statistics: {
      totalFiles: 109,
      totalLines: 14500,
      averageFileLines: 133,
      largestFiles: [{ path: 'src/components/data-table.tsx', lines: 487 }],
      filesByExtension: { '.ts': 42, '.tsx': 55, '.css': 12 },
    },
  };
}

function createNextjs15Config(): ViberailsConfig {
  return {
    $schema: 'https://viberails.sh/schema/v1.json',
    version: 1,
    name: 'my-app',
    enforcement: 'warn',
    stack: {
      framework: 'nextjs@15',
      language: 'typescript',
      styling: 'tailwindcss@4',
      packageManager: 'pnpm',
      linter: 'eslint@9',
      testRunner: 'vitest',
    },
    structure: {
      srcDir: 'src',
      pages: 'src/app',
      components: 'src/components',
      hooks: 'src/hooks',
      utils: 'src/lib',
      types: 'src/types',
      tests: '__tests__',
      testPattern: '*.test.ts',
    },
    conventions: {
      fileNaming: { value: 'kebab-case', _confidence: 'high', _consistency: 97 },
      componentNaming: {
        value: 'PascalCase',
        _confidence: 'high',
        _consistency: 94,
      },
      hookNaming: {
        value: 'useXxx',
        _confidence: 'medium',
        _consistency: 78,
      },
      importAlias: { value: '@/*', _confidence: 'high', _consistency: 100 },
    },
    rules: {
      maxFileLines: 300,
      maxFunctionLines: 50,
      requireTests: true,
      enforceNaming: true,
      enforceBoundaries: false,
    },
    ignore: ['**/*.d.ts', 'dist/**', 'node_modules/**'],
  };
}

describe('generateContext', () => {
  it('generates full context matching snapshot', () => {
    const config = createNextjs15Config();
    const scanResult = createNextjs15ScanResult();
    const output = generateContext(config, scanResult);

    expect(output).toMatchSnapshot();
  });

  it('contains Next.js 15 in architecture section', () => {
    const output = generateContext(createNextjs15Config(), createNextjs15ScanResult());

    expect(output).toContain('Next.js 15');
  });

  it('detects App Router from src/app directory', () => {
    const output = generateContext(createNextjs15Config(), createNextjs15ScanResult());

    expect(output).toContain('App Router');
  });

  it('contains convention directives for kebab-case', () => {
    const output = generateContext(createNextjs15Config(), createNextjs15ScanResult());

    expect(output).toContain('kebab-case');
    expect(output).toMatch(/Files use \*\*kebab-case\*\*/);
  });

  it('uses observation language for medium-confidence conventions', () => {
    const output = generateContext(createNextjs15Config(), createNextjs15ScanResult());

    expect(output).toMatch(/Most files appear to use \*\*useXxx\*\*/);
  });

  it('contains quality standards from rules', () => {
    const output = generateContext(createNextjs15Config(), createNextjs15ScanResult());

    expect(output).toContain('300 lines');
    expect(output).toContain('50 lines');
    expect(output).toContain('All public functions should have corresponding tests');
  });

  it('flags large files as refactoring candidates', () => {
    const output = generateContext(createNextjs15Config(), createNextjs15ScanResult());

    expect(output).toContain('data-table.tsx');
    expect(output).toContain('487 lines');
    expect(output).toContain('Refactoring candidates');
  });

  it('flags large directories for subdirectory organization', () => {
    const output = generateContext(createNextjs15Config(), createNextjs15ScanResult());

    expect(output).toContain('src/components');
    expect(output).toContain('47 files');
    expect(output).toContain('consider organizing into subdirectories');
  });

  it('mentions notable libraries', () => {
    const output = generateContext(createNextjs15Config(), createNextjs15ScanResult());

    expect(output).toContain('Zod');
    expect(output).toContain('React Query');
  });

  it('produces valid output with minimal input', () => {
    const minimalConfig: ViberailsConfig = {
      version: 1,
      name: 'minimal',
      enforcement: 'warn',
      stack: {
        language: 'javascript',
        packageManager: 'npm',
      },
      structure: {},
      conventions: {},
      rules: {
        maxFileLines: 300,
        maxFunctionLines: 50,
        requireTests: false,
        enforceNaming: false,
        enforceBoundaries: false,
      },
      ignore: [],
    };

    const minimalScan: ScanResult = {
      root: '/tmp/minimal',
      stack: {
        language: { name: 'javascript' },
        packageManager: { name: 'npm' },
        libraries: [],
      },
      structure: {
        directories: [],
      },
      conventions: {},
      statistics: {
        totalFiles: 5,
        totalLines: 200,
        averageFileLines: 40,
        largestFiles: [],
        filesByExtension: { '.js': 5 },
      },
    };

    const output = generateContext(minimalConfig, minimalScan);

    expect(output).toContain('# minimal');
    expect(output).toContain('## Architecture');
    expect(output).toContain('javascript');
    expect(output).toContain('## Quality Standards');
    expect(output).not.toContain('## Conventions');
  });

  it('includes test pattern in conventions', () => {
    const output = generateContext(createNextjs15Config(), createNextjs15ScanResult());

    expect(output).toContain('*.test.ts');
  });

  it('includes import alias in conventions', () => {
    const output = generateContext(createNextjs15Config(), createNextjs15ScanResult());

    expect(output).toContain('`@/*`');
  });
});
