import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { boundariesCommand } from './boundaries.js';

describe('boundaries command', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viberails-boundaries-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeConfig(overrides: Record<string, unknown> = {}): void {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test-project' }));
    const config = {
      version: 2,
      name: 'test-project',
      enforcement: 'warn',
      rules: {
        maxFileLines: 300,
        maxTestFileLines: 0,
        requireTests: false,
        enforceNaming: false,
        enforceBoundaries: false,
      },
      ignore: [],
      packages: [
        {
          name: 'test-project',
          path: '.',
          stack: { language: 'typescript', packageManager: 'pnpm' },
          structure: {},
          conventions: {},
        },
      ],
      ...overrides,
    };
    fs.writeFileSync(path.join(tmpDir, 'viberails.config.json'), JSON.stringify(config, null, 2));
  }

  it('shows no-rules message when no boundaries configured', async () => {
    writeConfig();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    try {
      await boundariesCommand({}, tmpDir);
      const output = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(output).toContain('No boundary rules configured');
      expect(output).toContain('--infer');
    } finally {
      logSpy.mockRestore();
    }
  });

  it('displays configured boundary rules', async () => {
    writeConfig({
      boundaries: {
        deny: {
          '@app/ui': ['@app/api'],
        },
      },
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    try {
      await boundariesCommand({}, tmpDir);
      const output = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(output).toContain('@app/ui');
      expect(output).toContain('@app/api');
      expect(output).toContain('1 deny rules');
    } finally {
      logSpy.mockRestore();
    }
  });

  it('shows graph for monorepo fixture', async () => {
    // Copy monorepo-basic fixture
    const fixtureSrc = path.resolve(__dirname, '../../../../tests/fixtures/monorepo-basic');
    fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viberails-boundaries-'));
    fs.cpSync(fixtureSrc, tmpDir, { recursive: true });

    // Write config with packages
    const config = {
      version: 2,
      name: 'monorepo-basic',
      enforcement: 'warn',
      rules: {
        maxFileLines: 300,
        maxTestFileLines: 0,
        requireTests: false,
        enforceNaming: false,
        enforceBoundaries: false,
      },
      ignore: [],
      packages: [
        {
          name: 'core',
          path: 'packages/core',
          stack: { language: 'typescript', packageManager: 'npm' },
          structure: {},
          conventions: {},
        },
        {
          name: 'api',
          path: 'packages/api',
          stack: { language: 'typescript', packageManager: 'npm' },
          structure: {},
          conventions: {},
        },
        {
          name: 'web',
          path: 'packages/web',
          stack: { language: 'typescript', packageManager: 'npm' },
          structure: {},
          conventions: {},
        },
      ],
    };
    fs.writeFileSync(path.join(tmpDir, 'viberails.config.json'), JSON.stringify(config, null, 2));

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    try {
      await boundariesCommand({ graph: true }, tmpDir);
      const output = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(output).toContain('Import dependency graph');
      expect(output).toContain('files');
    } finally {
      logSpy.mockRestore();
    }
  });
});
