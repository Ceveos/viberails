import type { ScanResult } from '@viberails/types';
import { describe, expect, it, vi } from 'vitest';
import { displayScanResults } from './display.js';

function makeScanResult(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    root: '/project',
    stack: {
      language: { name: 'typescript' },
      packageManager: { name: 'npm' },
      libraries: [],
      ...overrides.stack,
    },
    structure: {
      directories: [],
      ...overrides.structure,
    },
    conventions: overrides.conventions ?? {},
    statistics: {
      totalFiles: 0,
      totalLines: 0,
      averageFileLines: 0,
      largestFiles: [],
      filesByExtension: {},
      ...overrides.statistics,
    },
  };
}

describe('displayScanResults', () => {
  it('does not throw with minimal scan result', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(() => displayScanResults(makeScanResult())).not.toThrow();
    consoleSpy.mockRestore();
  });

  it('does not throw with full scan result', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(() =>
      displayScanResults(
        makeScanResult({
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
            ],
          },
          conventions: {
            fileNaming: {
              value: 'kebab-case',
              confidence: 'high',
              sampleSize: 50,
              consistency: 97,
            },
            componentNaming: {
              value: 'PascalCase',
              confidence: 'high',
              sampleSize: 30,
              consistency: 94,
            },
            hookNaming: {
              value: 'camelCase:usePrefix',
              confidence: 'medium',
              sampleSize: 8,
              consistency: 78,
            },
          },
        }),
      ),
    ).not.toThrow();
    consoleSpy.mockRestore();
  });

  it('does not throw with empty conventions', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(() => displayScanResults(makeScanResult({ conventions: {} }))).not.toThrow();
    consoleSpy.mockRestore();
  });

  it('skips low-confidence conventions', () => {
    const logs: string[] = [];
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.join(' '));
    });

    displayScanResults(
      makeScanResult({
        conventions: {
          fileNaming: { value: 'kebab-case', confidence: 'low', sampleSize: 5, consistency: 50 },
          componentNaming: {
            value: 'PascalCase',
            confidence: 'high',
            sampleSize: 20,
            consistency: 95,
          },
        },
      }),
    );

    const output = logs.join('\n');
    expect(output).not.toContain('kebab-case');
    expect(output).toContain('PascalCase');
    consoleSpy.mockRestore();
  });

  it('filters out unknown directories from structure display', () => {
    const logs: string[] = [];
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.join(' '));
    });

    displayScanResults(
      makeScanResult({
        structure: {
          directories: [
            { path: 'src/components', role: 'components', fileCount: 10, confidence: 'high' },
            { path: 'src/random', role: 'unknown', fileCount: 3, confidence: 'low' },
          ],
        },
      }),
    );

    const output = logs.join('\n');
    expect(output).toContain('src/components');
    expect(output).not.toContain('src/random');
    consoleSpy.mockRestore();
  });
});
