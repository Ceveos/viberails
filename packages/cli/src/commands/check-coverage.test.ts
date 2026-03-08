import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { ViberailsConfig } from '@viberails/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkCoverage } from './check-coverage.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-coverage-'));
  fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test-project' }));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makeConfig(overrides: Record<string, unknown> = {}): ViberailsConfig {
  return {
    version: 1,
    name: 'test-project',
    rules: {
      maxFileLines: 300,
      maxTestFileLines: 0,
      testCoverage: 80,
      enforceNaming: false,
      enforceBoundaries: false,
    },
    ignore: [],
    packages: [
      {
        name: 'test-project',
        path: '.',
        stack: { language: 'typescript', packageManager: 'pnpm', testRunner: 'vitest@3.0.0' },
        structure: {},
        conventions: {},
      },
    ],
    ...overrides,
  };
}

function writeSummary(
  dir: string,
  pct: number,
  summaryPath = 'coverage/coverage-summary.json',
): void {
  const abs = path.join(dir, summaryPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, JSON.stringify({ total: { lines: { pct } } }));
}

describe('checkCoverage', () => {
  it('passes when line coverage meets threshold', () => {
    writeSummary(tmpDir, 85);
    const violations = checkCoverage(tmpDir, makeConfig(), [], {});
    expect(violations).toHaveLength(0);
  });

  it('reports violation when line coverage is below threshold', () => {
    writeSummary(tmpDir, 60);
    const violations = checkCoverage(tmpDir, makeConfig(), [], {});
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe('test-coverage');
    expect(violations[0].message).toContain('below required 80%');
    expect(violations[0].severity).toBe('warn');
  });

  it('uses error severity in enforce mode', () => {
    writeSummary(tmpDir, 60);
    const violations = checkCoverage(tmpDir, makeConfig(), [], { enforce: true });
    expect(violations).toHaveLength(1);
    expect(violations[0].severity).toBe('error');
  });

  it('does not execute coverage command in staged mode', () => {
    const config = makeConfig({
      defaults: {
        coverage: {
          command: 'exit 1',
        },
      },
    });

    const violations = checkCoverage(tmpDir, config, ['src/file.ts'], { staged: true });
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('Coverage summary not found or invalid');
  });

  it('executes configured command in full mode when summary is missing', () => {
    const config = makeConfig({
      defaults: {
        coverage: {
          command:
            "node -e \"const fs=require('fs');fs.mkdirSync('coverage',{recursive:true});fs.writeFileSync('coverage/coverage-summary.json', JSON.stringify({total:{lines:{pct:88}}}));\"",
        },
      },
    });

    const violations = checkCoverage(tmpDir, config, [], {});
    expect(violations).toHaveLength(0);
  });

  it('prefers package coverage summaryPath over defaults coverage summaryPath', () => {
    writeSummary(tmpDir, 95, 'coverage/coverage-summary.json');
    writeSummary(tmpDir, 40, 'custom/summary.json');
    const config = makeConfig({
      defaults: {
        coverage: {
          summaryPath: 'coverage/coverage-summary.json',
        },
      },
      packages: [
        {
          name: 'test-project',
          path: '.',
          stack: { language: 'typescript', packageManager: 'pnpm', testRunner: 'vitest@3.0.0' },
          structure: {},
          conventions: {},
          coverage: {
            summaryPath: 'custom/summary.json',
          },
        },
      ],
    });

    const violations = checkCoverage(tmpDir, config, [], {});
    expect(violations).toHaveLength(1);
    expect(violations[0].file).toBe('custom/summary.json');
  });

  it('shows helpful message when no summary and no configured command', () => {
    const config = makeConfig({
      packages: [
        {
          name: 'test-project',
          path: '.',
          stack: { language: 'typescript', packageManager: 'pnpm' },
          structure: {},
          conventions: {},
        },
      ],
    });

    const violations = checkCoverage(tmpDir, config, [], {});
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('No coverage summary found');
    expect(violations[0].message).toContain('defaults.coverage.command');
  });

  it('does not auto-run inferred commands — only explicit coverage.command', () => {
    // Even with a known test runner, check should NOT auto-infer and run
    const config = makeConfig({
      packages: [
        {
          name: 'test-project',
          path: '.',
          stack: { language: 'typescript', packageManager: 'pnpm', testRunner: 'vitest@4.0.0' },
          structure: {},
          conventions: {},
        },
      ],
    });

    const violations = checkCoverage(tmpDir, config, [], {});
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('No coverage summary found');
  });
});
