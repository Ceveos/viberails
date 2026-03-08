import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { ScanResult } from '@viberails/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkCoveragePrereqs } from './check-prerequisites.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prereqs-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function baseScanResult(overrides: Partial<ScanResult['stack']> = {}): ScanResult {
  return {
    root: tmpDir,
    stack: {
      language: { name: 'typescript', version: '5' },
      packageManager: { name: 'pnpm' },
      libraries: [],
      ...overrides,
    },
    structure: { directories: [] },
    conventions: {},
    statistics: {
      totalFiles: 10,
      totalLines: 500,
      averageFileLines: 50,
      largestFiles: [],
      filesByExtension: {},
    },
    packages: [],
  };
}

describe('checkCoveragePrereqs', () => {
  it('returns empty for projects without a test runner', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({}));
    const result = checkCoveragePrereqs(tmpDir, baseScanResult());
    expect(result).toHaveLength(0);
  });

  it('returns empty for jest projects (built-in coverage)', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({}));
    const scan = baseScanResult({ testRunner: { name: 'jest', version: '29' } });
    const result = checkCoveragePrereqs(tmpDir, scan);
    expect(result).toHaveLength(0);
  });

  it('detects missing @vitest/coverage-v8', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ devDependencies: { vitest: '^3.0.0' } }),
    );
    const scan = baseScanResult({ testRunner: { name: 'vitest', version: '3' } });
    const result = checkCoveragePrereqs(tmpDir, scan);
    expect(result).toHaveLength(1);
    expect(result[0].installed).toBe(false);
    expect(result[0].installCommand).toContain('pnpm add -D @vitest/coverage-v8');
  });

  it('detects installed @vitest/coverage-v8', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({
        devDependencies: { vitest: '^3.0.0', '@vitest/coverage-v8': '^3.0.0' },
      }),
    );
    const scan = baseScanResult({ testRunner: { name: 'vitest', version: '3' } });
    const result = checkCoveragePrereqs(tmpDir, scan);
    expect(result).toHaveLength(1);
    expect(result[0].installed).toBe(true);
    expect(result[0].installCommand).toBeUndefined();
  });

  it('detects @vitest/coverage-istanbul as alternative', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({
        devDependencies: { vitest: '^3.0.0', '@vitest/coverage-istanbul': '^3.0.0' },
      }),
    );
    const scan = baseScanResult({ testRunner: { name: 'vitest', version: '3' } });
    const result = checkCoveragePrereqs(tmpDir, scan);
    expect(result[0].installed).toBe(true);
  });

  it('uses correct install command for npm', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ devDependencies: { vitest: '^3.0.0' } }),
    );
    const scan = baseScanResult({
      testRunner: { name: 'vitest', version: '3' },
      packageManager: { name: 'npm' },
    });
    const result = checkCoveragePrereqs(tmpDir, scan);
    expect(result[0].installCommand).toContain('npm install -D');
  });

  it('uses correct install command for yarn', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ devDependencies: { vitest: '^3.0.0' } }),
    );
    const scan = baseScanResult({
      testRunner: { name: 'vitest', version: '3' },
      packageManager: { name: 'yarn' },
    });
    const result = checkCoveragePrereqs(tmpDir, scan);
    expect(result[0].installCommand).toContain('yarn add -D');
  });
});
