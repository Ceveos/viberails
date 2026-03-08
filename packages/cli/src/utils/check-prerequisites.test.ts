import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { PackageScanResult, ScanResult } from '@viberails/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkCoveragePrereqs } from './check-prerequisites.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prereqs-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const defaultStats = {
  totalFiles: 10,
  totalLines: 500,
  averageFileLines: 50,
  largestFiles: [],
  filesByExtension: {},
};

function makePackage(relativePath: string, runner?: string): PackageScanResult {
  return {
    name: relativePath,
    root: path.join(tmpDir, relativePath),
    relativePath,
    stack: {
      language: { name: 'typescript' },
      packageManager: { name: 'pnpm' },
      libraries: [],
      ...(runner ? { testRunner: { name: runner } } : {}),
    },
    structure: { directories: [] },
    conventions: {},
    statistics: defaultStats,
  };
}

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
    statistics: defaultStats,
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

describe('checkCoveragePrereqs — monorepo', () => {
  function writePkg(dir: string, deps: Record<string, string> = {}): void {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ devDependencies: deps }));
  }

  it('detects missing provider when child packages use vitest', () => {
    writePkg(tmpDir, { vitest: '^3' });
    writePkg(path.join(tmpDir, 'apps/web'), { vitest: '^3' });
    writePkg(path.join(tmpDir, 'packages/db'), { vitest: '^3' });

    const scan = baseScanResult({ testRunner: { name: 'vitest' } });
    scan.packages = [makePackage('apps/web', 'vitest'), makePackage('packages/db', 'vitest')];

    const result = checkCoveragePrereqs(tmpDir, scan);
    expect(result).toHaveLength(1);
    expect(result[0].installed).toBe(false);
    expect(result[0].affectedPackages).toEqual(['apps/web', 'packages/db']);
  });

  it('detects installed provider at workspace root', () => {
    writePkg(tmpDir, { '@vitest/coverage-v8': '^3' });
    writePkg(path.join(tmpDir, 'apps/web'), { vitest: '^3' });

    const scan = baseScanResult({ testRunner: { name: 'vitest' } });
    scan.packages = [makePackage('apps/web', 'vitest'), makePackage('packages/db', 'vitest')];

    const result = checkCoveragePrereqs(tmpDir, scan);
    expect(result[0].installed).toBe(true);
  });

  it('detects provider installed in every child package', () => {
    writePkg(tmpDir);
    writePkg(path.join(tmpDir, 'apps/web'), { '@vitest/coverage-v8': '^3' });
    writePkg(path.join(tmpDir, 'packages/db'), { '@vitest/coverage-v8': '^3' });

    const scan = baseScanResult({ testRunner: { name: 'vitest' } });
    scan.packages = [makePackage('apps/web', 'vitest'), makePackage('packages/db', 'vitest')];

    const result = checkCoveragePrereqs(tmpDir, scan);
    expect(result[0].installed).toBe(true);
  });

  it('detects missing when only some child packages have provider', () => {
    writePkg(tmpDir);
    writePkg(path.join(tmpDir, 'apps/web'), { '@vitest/coverage-v8': '^3' });
    writePkg(path.join(tmpDir, 'packages/db'));

    const scan = baseScanResult({ testRunner: { name: 'vitest' } });
    scan.packages = [makePackage('apps/web', 'vitest'), makePackage('packages/db', 'vitest')];

    const result = checkCoveragePrereqs(tmpDir, scan);
    expect(result[0].installed).toBe(false);
  });

  it('detects vitest need in mixed-runner monorepo (jest + vitest)', () => {
    writePkg(tmpDir);
    writePkg(path.join(tmpDir, 'apps/mobile'));
    writePkg(path.join(tmpDir, 'apps/web'));

    const scan = baseScanResult({ testRunner: { name: 'jest' } });
    scan.packages = [makePackage('apps/mobile', 'jest'), makePackage('apps/web', 'vitest')];

    const result = checkCoveragePrereqs(tmpDir, scan);
    expect(result).toHaveLength(1);
    expect(result[0].installed).toBe(false);
    expect(result[0].label).toBe('@vitest/coverage-v8');
  });

  it('returns empty when all packages use jest', () => {
    writePkg(tmpDir);
    const scan = baseScanResult({ testRunner: { name: 'jest' } });
    scan.packages = [makePackage('apps/mobile', 'jest'), makePackage('apps/api', 'jest')];

    const result = checkCoveragePrereqs(tmpDir, scan);
    expect(result).toHaveLength(0);
  });

  it('does not set affectedPackages for single vitest package', () => {
    writePkg(tmpDir);
    writePkg(path.join(tmpDir, 'apps/web'));

    const scan = baseScanResult({ testRunner: { name: 'vitest' } });
    scan.packages = [makePackage('apps/web', 'vitest')];

    const result = checkCoveragePrereqs(tmpDir, scan);
    expect(result[0].affectedPackages).toBeUndefined();
  });
});
