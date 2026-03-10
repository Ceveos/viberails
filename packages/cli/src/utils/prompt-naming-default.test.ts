import type { DetectedConvention, ScanResult, ViberailsConfig } from '@viberails/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveNamingDefault } from './prompt-naming-default.js';

const { selectMock, isCancelMock, noteMock } = vi.hoisted(() => ({
  selectMock: vi.fn(),
  isCancelMock: vi.fn((value: unknown) => value === '__cancel__'),
  noteMock: vi.fn(),
}));

vi.mock('@clack/prompts', () => ({
  select: selectMock,
  cancel: vi.fn(),
  isCancel: isCancelMock,
  note: noteMock,
}));

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
    packages: [{ name: 'root', path: '.', conventions: {} }],
    ...overrides,
  };
}

function makeScanResult(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    root: '/test',
    stack: { language: { name: 'typescript' }, packageManager: { name: 'pnpm' }, libraries: [] },
    structure: { directories: [] },
    conventions: {},
    statistics: {
      totalFiles: 10,
      totalLines: 1000,
      averageFileLines: 100,
      largestFiles: [],
      filesByExtension: {},
    },
    packages: [],
    ...overrides,
  };
}

describe('resolveNamingDefault', () => {
  beforeEach(() => {
    selectMock.mockReset();
    noteMock.mockReset();
  });

  it('skips when naming is already set', async () => {
    const config = makeConfig({
      packages: [{ name: 'root', path: '.', conventions: { fileNaming: 'kebab-case' } }],
    });
    const result = await resolveNamingDefault(config, makeScanResult());
    expect(result).toBe(false);
    expect(selectMock).not.toHaveBeenCalled();
  });

  it('skips when enforceNaming is false', async () => {
    const config = makeConfig();
    config.rules.enforceNaming = false;
    const result = await resolveNamingDefault(config, makeScanResult());
    expect(result).toBe(false);
  });

  it('sets naming on root package when user picks a convention', async () => {
    selectMock.mockResolvedValueOnce('camelCase');
    const config = makeConfig();
    const result = await resolveNamingDefault(config, makeScanResult());

    expect(result).toBe(true);
    expect(config.packages[0].conventions?.fileNaming).toBe('camelCase');
    expect(config.rules.enforceNaming).toBe(true);
  });

  it('disables enforcement when user picks skip', async () => {
    selectMock.mockResolvedValueOnce('__skip__');
    const config = makeConfig();
    await resolveNamingDefault(config, makeScanResult());

    expect(config.rules.enforceNaming).toBe(false);
  });

  it('shows per-package note for monorepos with detection data', async () => {
    selectMock.mockResolvedValueOnce('kebab-case');
    const naming: DetectedConvention = {
      value: 'kebab-case',
      confidence: 'high',
      sampleSize: 10,
      consistency: 92,
    };
    const config = makeConfig({
      packages: [
        { name: 'root', path: '.', conventions: {} },
        { name: 'web', path: 'apps/web', conventions: {} },
      ],
    });
    const scanResult = makeScanResult({
      packages: [
        {
          relativePath: 'apps/web',
          conventions: { fileNaming: naming },
        },
      ] as unknown as ScanResult['packages'],
    });

    await resolveNamingDefault(config, scanResult);
    expect(noteMock).toHaveBeenCalled();
  });
});
