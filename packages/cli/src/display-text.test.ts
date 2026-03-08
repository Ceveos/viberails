import type { ScanResult, ViberailsConfig } from '@viberails/types';
import { describe, expect, it } from 'vitest';
import { formatConventionsText, formatRulesText, formatScanResultsText } from './display-text.js';

function makeScanResult(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    root: '/test',
    stack: {
      language: { name: 'typescript', version: '5' },
      packageManager: { name: 'pnpm' },
      libraries: [],
    },
    structure: { directories: [] },
    conventions: {},
    statistics: {
      totalFiles: 10,
      totalLines: 500,
      averageFileLines: 50,
      largestFiles: [],
      filesByExtension: { '.ts': 10 },
    },
    packages: [
      {
        name: 'test',
        root: '/test',
        relativePath: '.',
        stack: {
          language: { name: 'typescript', version: '5' },
          packageManager: { name: 'pnpm' },
          libraries: [],
        },
        structure: { directories: [] },
        conventions: {},
        statistics: {
          totalFiles: 10,
          totalLines: 500,
          averageFileLines: 50,
          largestFiles: [],
          filesByExtension: { '.ts': 10 },
        },
      },
    ],
    ...overrides,
  };
}

function makeConfig(overrides: Partial<ViberailsConfig> = {}): ViberailsConfig {
  return {
    version: 1,
    name: 'test',
    rules: {
      maxFileLines: 300,
      maxTestFileLines: 0,
      testCoverage: 80,
      enforceNaming: true,
      enforceBoundaries: false,
      enforceMissingTests: true,
    },
    packages: [
      {
        name: 'test',
        path: '.',
        conventions: { fileNaming: 'kebab-case' },
        structure: { testPattern: '*.test.ts' },
      },
    ],
    ...overrides,
  };
}

describe('formatRulesText', () => {
  it('includes max file size', () => {
    const lines = formatRulesText(makeConfig());
    expect(lines.some((l) => l.includes('300 lines'))).toBe(true);
  });

  it('includes coverage target when enabled', () => {
    const lines = formatRulesText(makeConfig());
    expect(lines.some((l) => l.includes('80%'))).toBe(true);
  });

  it('shows disabled when testCoverage is 0', () => {
    const config = makeConfig({ rules: { ...makeConfig().rules, testCoverage: 0 } });
    const lines = formatRulesText(config);
    expect(lines.some((l) => l.includes('disabled'))).toBe(true);
  });

  it('includes file naming convention', () => {
    const lines = formatRulesText(makeConfig());
    expect(lines.some((l) => l.includes('kebab-case'))).toBe(true);
  });
});

describe('formatConventionsText', () => {
  it('returns empty for no conventions', () => {
    expect(formatConventionsText(makeScanResult())).toHaveLength(0);
  });

  it('includes convention entries', () => {
    const scan = makeScanResult({
      conventions: {
        fileNaming: { value: 'kebab-case', confidence: 'high', sampleSize: 10, consistency: 95 },
      },
    });
    const lines = formatConventionsText(scan);
    expect(lines.some((l) => l.includes('kebab-case'))).toBe(true);
  });

  it('skips low-confidence conventions', () => {
    const scan = makeScanResult({
      conventions: {
        fileNaming: { value: 'kebab-case', confidence: 'low', sampleSize: 3, consistency: 40 },
      },
    });
    const lines = formatConventionsText(scan);
    expect(lines.filter((l) => l.includes('kebab-case'))).toHaveLength(0);
  });
});

describe('formatScanResultsText', () => {
  it('produces multi-line output', () => {
    const text = formatScanResultsText(makeScanResult());
    expect(text).toContain('Detected:');
    expect(text).toContain('typescript');
  });
});
