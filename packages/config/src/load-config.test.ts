import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { ViberailsConfig } from '@viberails/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig, loadConfigSafe } from './load-config.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'viberails-config-test-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function validConfig(): ViberailsConfig {
  return {
    $schema: 'https://viberails.sh/schema/v1.json',
    version: 1,
    name: 'test-project',
    packages: [
      {
        name: 'test-project',
        path: '.',
        stack: {
          language: 'typescript',
          packageManager: 'pnpm',
        },
        structure: {},
        conventions: {},
      },
    ],
    rules: {
      maxFileLines: 300,
      maxTestFileLines: 0,
      testCoverage: 80,
      enforceNaming: true,
      enforceBoundaries: false,
    },
    ignore: [],
  };
}

describe('loadConfig', () => {
  it('loads a valid config file', async () => {
    const configPath = path.join(tmpDir, 'viberails.config.json');
    const config = validConfig();
    await fs.writeFile(configPath, JSON.stringify(config));

    const loaded = await loadConfig(configPath);
    expect(loaded).toEqual(config);
  });

  it('throws a descriptive error for a missing file', async () => {
    const configPath = path.join(tmpDir, 'nonexistent.json');

    await expect(loadConfig(configPath)).rejects.toThrow('Config file not found');
    await expect(loadConfig(configPath)).rejects.toThrow(configPath);
  });

  it('throws a descriptive error for invalid JSON', async () => {
    const configPath = path.join(tmpDir, 'bad.json');
    await fs.writeFile(configPath, '{ not valid json }}}');

    await expect(loadConfig(configPath)).rejects.toThrow('Invalid JSON');
  });

  it('throws when required fields are missing', async () => {
    const configPath = path.join(tmpDir, 'incomplete.json');
    await fs.writeFile(configPath, JSON.stringify({ version: 1 }));

    await expect(loadConfig(configPath)).rejects.toThrow('missing required field(s)');
    await expect(loadConfig(configPath)).rejects.toThrow('name');
    await expect(loadConfig(configPath)).rejects.toThrow('packages');
    await expect(loadConfig(configPath)).rejects.toThrow('rules');
  });

  it('throws when packages have missing required fields', async () => {
    const configPath = path.join(tmpDir, 'bad-packages.json');
    await fs.writeFile(
      configPath,
      JSON.stringify({
        version: 1,
        name: 'test',
        packages: [{}],
        rules: {
          maxFileLines: 300,
          testCoverage: 80,
          enforceNaming: true,
          enforceBoundaries: false,
        },
      }),
    );

    await expect(loadConfig(configPath)).rejects.toThrow('packages[0].name');
    await expect(loadConfig(configPath)).rejects.toThrow('packages[0].path');
  });

  it('throws when rules have wrong types', async () => {
    const configPath = path.join(tmpDir, 'bad-rules.json');
    await fs.writeFile(
      configPath,
      JSON.stringify({
        version: 1,
        name: 'test',
        packages: [{ name: 'test', path: '.' }],
        rules: {
          maxFileLines: 'not-a-number',
          testCoverage: 80,
          enforceNaming: true,
          enforceBoundaries: false,
        },
      }),
    );

    await expect(loadConfig(configPath)).rejects.toThrow('rules.maxFileLines');
  });

  it('throws when version is not supported', async () => {
    const configPath = path.join(tmpDir, 'bad-version.json');
    await fs.writeFile(
      configPath,
      JSON.stringify({
        version: 2,
        name: 'test',
        packages: [{ name: 'test', path: '.' }],
        rules: {
          maxFileLines: 300,
          testCoverage: 80,
          enforceNaming: true,
          enforceBoundaries: false,
        },
      }),
    );

    await expect(loadConfig(configPath)).rejects.toThrow('"version" must be 1');
  });

  it('throws when packages array is empty', async () => {
    const configPath = path.join(tmpDir, 'empty-packages.json');
    await fs.writeFile(
      configPath,
      JSON.stringify({
        version: 1,
        name: 'test',
        packages: [],
        rules: {
          maxFileLines: 300,
          testCoverage: 80,
          enforceNaming: true,
          enforceBoundaries: false,
        },
      }),
    );

    await expect(loadConfig(configPath)).rejects.toThrow(
      '"packages" must contain at least one package',
    );
  });
});

describe('loadConfigSafe', () => {
  it('returns a valid config when file exists', async () => {
    const configPath = path.join(tmpDir, 'viberails.config.json');
    const config = validConfig();
    await fs.writeFile(configPath, JSON.stringify(config));

    const loaded = await loadConfigSafe(configPath);
    expect(loaded).toEqual(config);
  });

  it('returns null for a missing file', async () => {
    const configPath = path.join(tmpDir, 'nonexistent.json');
    const loaded = await loadConfigSafe(configPath);
    expect(loaded).toBeNull();
  });

  it('returns null for invalid JSON', async () => {
    const configPath = path.join(tmpDir, 'bad.json');
    await fs.writeFile(configPath, 'not json');

    const loaded = await loadConfigSafe(configPath);
    expect(loaded).toBeNull();
  });
});
