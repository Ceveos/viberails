import type { ScanResult } from '@viberails/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { promptPrereqs } from './prompt-prereqs.js';

const { selectMock, isCancelMock } = vi.hoisted(() => ({
  selectMock: vi.fn(),
  isCancelMock: vi.fn((value: unknown) => value === '__cancel__'),
}));

vi.mock('@clack/prompts', () => ({
  select: selectMock,
  cancel: vi.fn(),
  isCancel: isCancelMock,
  spinner: () => ({ start: vi.fn(), stop: vi.fn() }),
  log: { info: vi.fn(), warn: vi.fn() },
  outro: vi.fn(),
}));

vi.mock('./spawn-async.js', () => ({
  spawnAsync: vi.fn(() => Promise.resolve({ status: 0, stdout: '', stderr: '' })),
}));

vi.mock('../commands/init-hooks.js', () => ({
  detectHookManager: vi.fn(() => 'lefthook'),
}));

vi.mock('node:fs', async (importOriginal) => {
  const orig = await importOriginal<typeof import('node:fs')>();
  return { ...orig, existsSync: vi.fn(() => false), writeFileSync: vi.fn() };
});

function makeScanResult(hasTestRunner: boolean): ScanResult {
  return {
    root: '/test',
    stack: {
      language: { name: 'typescript' },
      packageManager: { name: 'pnpm' },
      libraries: [],
      ...(hasTestRunner ? { testRunner: { name: 'vitest' } } : {}),
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

describe('promptPrereqs', () => {
  beforeEach(() => vi.clearAllMocks());

  it('skips test runner prompt when already installed', async () => {
    // Only hook manager prompt needed — skip it
    selectMock.mockResolvedValueOnce('skip');
    const result = await promptPrereqs('/test', makeScanResult(true), undefined, 'pnpm', false);
    expect(result.hasTestRunner).toBe(true);
    expect(result.skipCoverage).toBe(false);
  });

  it('skips hook manager prompt when already installed', async () => {
    // Only test runner prompt needed — skip it
    selectMock.mockResolvedValueOnce('skip');
    const result = await promptPrereqs('/test', makeScanResult(false), 'lefthook', 'pnpm', false);
    expect(result.hookManager).toBe('lefthook');
    expect(result.skipHooks).toBe(false);
    expect(result.skipCoverage).toBe(true);
  });

  it('skips both when both already installed', async () => {
    const result = await promptPrereqs('/test', makeScanResult(true), 'lefthook', 'pnpm', false);
    expect(result.hasTestRunner).toBe(true);
    expect(result.hookManager).toBe('lefthook');
    expect(result.skipCoverage).toBe(false);
    expect(result.skipHooks).toBe(false);
    expect(selectMock).not.toHaveBeenCalled();
  });

  it('sets skipCoverage when user skips test runner', async () => {
    selectMock
      .mockResolvedValueOnce('skip') // test runner
      .mockResolvedValueOnce('skip'); // hook manager
    const result = await promptPrereqs('/test', makeScanResult(false), undefined, 'pnpm', false);
    expect(result.skipCoverage).toBe(true);
    expect(result.hasTestRunner).toBe(false);
  });

  it('sets skipHooks when user skips hook manager', async () => {
    selectMock.mockResolvedValueOnce('skip');
    const result = await promptPrereqs('/test', makeScanResult(true), undefined, 'pnpm', false);
    expect(result.skipHooks).toBe(true);
  });

  it('installs vitest when user chooses install', async () => {
    selectMock.mockResolvedValueOnce('install'); // test runner — install
    const result = await promptPrereqs('/test', makeScanResult(false), 'lefthook', 'pnpm', false);
    expect(result.hasTestRunner).toBe(true);
    expect(result.skipCoverage).toBe(false);
  });

  it('exits when user selects exit on test runner prompt', async () => {
    selectMock.mockResolvedValueOnce('exit');
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit');
    });
    await expect(
      promptPrereqs('/test', makeScanResult(false), 'lefthook', 'pnpm', false),
    ).rejects.toThrow('exit');
    expect(exitSpy).toHaveBeenCalledWith(0);
    exitSpy.mockRestore();
  });
});
