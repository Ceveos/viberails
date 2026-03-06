import type { ScanResult } from '@viberails/types';
import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import { generateConfig } from './generate-config.js';
import { configSchema } from './schema.js';

function makeMinimalScanResult(): ScanResult {
  return {
    root: '/project/my-app',
    stack: {
      language: { name: 'typescript' },
      packageManager: { name: 'npm' },
      libraries: [],
    },
    structure: {
      directories: [],
    },
    conventions: {},
    statistics: {
      totalFiles: 10,
      totalLines: 500,
      averageFileLines: 50,
      largestFiles: [],
      filesByExtension: { '.ts': 10 },
    },
  };
}

function makeFullScanResult(): ScanResult {
  return {
    root: '/project/my-app',
    stack: {
      framework: { name: 'nextjs', version: '15' },
      language: { name: 'typescript' },
      styling: { name: 'tailwindcss', version: '4' },
      backend: { name: 'supabase' },
      linter: { name: 'eslint', version: '9' },
      testRunner: { name: 'vitest' },
      packageManager: { name: 'pnpm' },
      libraries: [{ name: 'zod', version: '3' }],
    },
    structure: {
      srcDir: 'src',
      directories: [
        { path: 'src/app', role: 'pages', fileCount: 12, confidence: 'high' },
        { path: 'src/components', role: 'components', fileCount: 47, confidence: 'high' },
        { path: 'src/hooks', role: 'hooks', fileCount: 8, confidence: 'high' },
        { path: 'src/lib', role: 'utils', fileCount: 14, confidence: 'high' },
        { path: '__tests__', role: 'tests', fileCount: 23, confidence: 'high' },
      ],
      testPattern: { value: '*.test.ts', confidence: 'high', sampleSize: 23, consistency: 95 },
    },
    conventions: {
      fileNaming: { value: 'kebab-case', confidence: 'high', sampleSize: 50, consistency: 97 },
      componentNaming: { value: 'PascalCase', confidence: 'high', sampleSize: 30, consistency: 94 },
      hookNaming: {
        value: 'camelCase:usePrefix',
        confidence: 'medium',
        sampleSize: 8,
        consistency: 78,
      },
      importAlias: { value: '@/*', confidence: 'high', sampleSize: 1, consistency: 100 },
    },
    statistics: {
      totalFiles: 100,
      totalLines: 15000,
      averageFileLines: 150,
      largestFiles: [{ path: 'src/components/data-table.tsx', lines: 487 }],
      filesByExtension: { '.ts': 60, '.tsx': 40 },
    },
  };
}

describe('configSchema validation', () => {
  it('schema is a valid JSON Schema', () => {
    const ajv = new Ajv();
    const validate = ajv.compile(configSchema);
    expect(validate).toBeDefined();
  });

  it('validates a generated config from minimal scan result', () => {
    const ajv = new Ajv();
    const validate = ajv.compile(configSchema);
    const config = generateConfig(makeMinimalScanResult());
    const valid = validate(config);
    if (!valid) {
      console.error('Validation errors:', validate.errors);
    }
    expect(valid).toBe(true);
  });

  it('validates a generated config from full scan result', () => {
    const ajv = new Ajv();
    const validate = ajv.compile(configSchema);
    const config = generateConfig(makeFullScanResult());
    const valid = validate(config);
    if (!valid) {
      console.error('Validation errors:', validate.errors);
    }
    expect(valid).toBe(true);
  });

  it('rejects config missing required fields', () => {
    const ajv = new Ajv();
    const validate = ajv.compile(configSchema);

    expect(validate({})).toBe(false);
    expect(validate({ version: 1 })).toBe(false);
    expect(validate({ version: 1, name: 'test' })).toBe(false);
  });

  it('rejects config with invalid version', () => {
    const ajv = new Ajv();
    const validate = ajv.compile(configSchema);

    expect(
      validate({
        version: 2,
        name: 'test',
        stack: { language: 'typescript', packageManager: 'npm' },
        rules: {
          maxFileLines: 300,
          maxFunctionLines: 50,
          requireTests: true,
          enforceNaming: true,
          enforceBoundaries: false,
        },
      }),
    ).toBe(false);
  });

  it('rejects config with additional properties', () => {
    const ajv = new Ajv();
    const validate = ajv.compile(configSchema);

    const config = generateConfig(makeMinimalScanResult());
    const invalid = { ...config, unknownField: 'bad' };
    expect(validate(invalid)).toBe(false);
  });
});
