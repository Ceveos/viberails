import { describe, expect, it } from 'vitest';
import type { ScanResult } from '@viberails/types';
import { generateConfig } from './generate-config.js';
import { DEFAULT_RULES } from './defaults.js';

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
        { path: 'src/components', role: 'components', fileCount: 47, confidence: 'high' },
        { path: 'src/hooks', role: 'hooks', fileCount: 8, confidence: 'high' },
        { path: 'src/lib', role: 'utils', fileCount: 14, confidence: 'high' },
        { path: 'src/types', role: 'types', fileCount: 5, confidence: 'high' },
        { path: '__tests__', role: 'tests', fileCount: 23, confidence: 'high' },
      ],
      testPattern: { value: '*.test.ts', confidence: 'high', sampleSize: 23, consistency: 95 },
    },
    conventions: {
      fileNaming: { value: 'kebab-case', confidence: 'high', sampleSize: 100, consistency: 97 },
      componentNaming: { value: 'PascalCase', confidence: 'high', sampleSize: 47, consistency: 94 },
      hookNaming: { value: 'useXxx', confidence: 'medium', sampleSize: 8, consistency: 78 },
      importAlias: { value: '@/*', confidence: 'high', sampleSize: 1, consistency: 100 },
    },
    statistics: {
      totalFiles: 109,
      totalLines: 14500,
      averageFileLines: 133,
      largestFiles: [
        { path: 'src/components/data-table.tsx', lines: 487 },
      ],
      filesByExtension: { '.ts': 42, '.tsx': 55, '.css': 12 },
    },
  };
}

describe('generateConfig', () => {
  it('generates a complete config from a Next.js 15 scan result', () => {
    const scanResult = createNextjs15ScanResult();
    const config = generateConfig(scanResult);

    expect(config.$schema).toBe('https://viberails.sh/schema/v1.json');
    expect(config.version).toBe(1);
    expect(config.name).toBe('my-app');
    expect(config.enforcement).toBe('warn');

    expect(config.stack.framework).toBe('nextjs@15');
    expect(config.stack.language).toBe('typescript');
    expect(config.stack.styling).toBe('tailwindcss@4');
    expect(config.stack.packageManager).toBe('pnpm');
    expect(config.stack.linter).toBe('eslint@9');
    expect(config.stack.testRunner).toBe('vitest');

    expect(config.structure.srcDir).toBe('src');
    expect(config.structure.pages).toBe('src/app');
    expect(config.structure.components).toBe('src/components');
    expect(config.structure.hooks).toBe('src/hooks');
    expect(config.structure.utils).toBe('src/lib');
    expect(config.structure.types).toBe('src/types');
    expect(config.structure.tests).toBe('__tests__');
    expect(config.structure.testPattern).toBe('*.test.ts');
  });

  it('includes high-confidence conventions with metadata', () => {
    const scanResult = createNextjs15ScanResult();
    const config = generateConfig(scanResult);

    expect(config.conventions.fileNaming).toEqual({
      value: 'kebab-case',
      _confidence: 'high',
      _consistency: 97,
    });
    expect(config.conventions.componentNaming).toEqual({
      value: 'PascalCase',
      _confidence: 'high',
      _consistency: 94,
    });
  });

  it('includes medium-confidence conventions with annotations', () => {
    const scanResult = createNextjs15ScanResult();
    const config = generateConfig(scanResult);

    expect(config.conventions.hookNaming).toEqual({
      value: 'useXxx',
      _confidence: 'medium',
      _consistency: 78,
    });
  });

  it('omits low-confidence conventions', () => {
    const scanResult = createNextjs15ScanResult();
    scanResult.conventions.fileNaming = {
      value: 'kebab-case',
      confidence: 'low',
      sampleSize: 10,
      consistency: 55,
    };

    const config = generateConfig(scanResult);
    expect(config.conventions.fileNaming).toBeUndefined();
  });

  it('applies default rules', () => {
    const scanResult = createNextjs15ScanResult();
    const config = generateConfig(scanResult);

    expect(config.rules).toEqual(DEFAULT_RULES);
  });

  it('sets default ignore patterns', () => {
    const scanResult = createNextjs15ScanResult();
    const config = generateConfig(scanResult);

    expect(config.ignore).toEqual(['**/*.d.ts', 'dist/**', 'node_modules/**']);
  });

  it('derives project name from root path basename', () => {
    const scanResult = createNextjs15ScanResult();
    scanResult.root = '/some/path/cool-project';

    const config = generateConfig(scanResult);
    expect(config.name).toBe('cool-project');
  });

  it('handles stack items without versions', () => {
    const scanResult = createNextjs15ScanResult();
    scanResult.stack.framework = { name: 'nextjs' };

    const config = generateConfig(scanResult);
    expect(config.stack.framework).toBe('nextjs');
  });

  it('handles missing optional stack fields', () => {
    const scanResult = createNextjs15ScanResult();
    delete scanResult.stack.framework;
    delete scanResult.stack.styling;
    delete scanResult.stack.backend;
    delete scanResult.stack.linter;
    delete scanResult.stack.testRunner;

    const config = generateConfig(scanResult);
    expect(config.stack.framework).toBeUndefined();
    expect(config.stack.styling).toBeUndefined();
    expect(config.stack.backend).toBeUndefined();
    expect(config.stack.linter).toBeUndefined();
    expect(config.stack.testRunner).toBeUndefined();
    expect(config.stack.language).toBe('typescript');
    expect(config.stack.packageManager).toBe('pnpm');
  });

  it('produces valid JSON that round-trips correctly', () => {
    const scanResult = createNextjs15ScanResult();
    const config = generateConfig(scanResult);

    const json = JSON.stringify(config);
    const parsed = JSON.parse(json);
    expect(parsed).toEqual(config);
  });

  it('handles empty conventions', () => {
    const scanResult = createNextjs15ScanResult();
    scanResult.conventions = {};

    const config = generateConfig(scanResult);
    expect(config.conventions).toEqual({});
  });

  it('uses first directory found for each role', () => {
    const scanResult = createNextjs15ScanResult();
    scanResult.structure.directories = [
      { path: 'src/components', role: 'components', fileCount: 30, confidence: 'high' },
      { path: 'src/ui', role: 'components', fileCount: 10, confidence: 'medium' },
    ];

    const config = generateConfig(scanResult);
    expect(config.structure.components).toBe('src/components');
  });
});
