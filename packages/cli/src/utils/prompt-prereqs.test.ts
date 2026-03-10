import type { ScanResult } from '@viberails/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildReadinessLines, promptPrereqs } from './prompt-prereqs.js';

const { selectMock, noteMock, isCancelMock } = vi.hoisted(() => ({
  selectMock: vi.fn(),
  noteMock: vi.fn(),
  isCancelMock: vi.fn((value: unknown) => value === '__cancel__'),
}));

vi.mock('@clack/prompts', () => ({
  select: selectMock,
  note: noteMock,
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

vi.mock('../commands/resolve-typecheck.js', () => ({
  resolveTypecheckCommand: vi.fn(() => ({ label: undefined, reason: 'no tsconfig' })),
}));

vi.mock('node:fs', async (importOriginal) => {
  const orig = await importOriginal<typeof import('node:fs')>();
  return { ...orig, existsSync: vi.fn(() => false), writeFileSync: vi.fn() };
});

function makeScanResult(hasTestRunner: boolean, linter?: string): ScanResult {
  return {
    root: '/test',
    stack: {
      language: { name: 'typescript' },
      packageManager: { name: 'pnpm' },
      libraries: [],
      ...(hasTestRunner ? { testRunner: { name: 'vitest' } } : {}),
      ...(linter ? { linter: { name: linter } } : {}),
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

describe('buildReadinessLines', () => {
  it('returns empty when everything is detected', () => {
    const lines = buildReadinessLines(true, 'vitest', 'Lefthook', 'biome', {
      label: 'tsc --noEmit',
    });
    expect(lines).toEqual([]);
  });

  it('returns lines when test runner is missing', () => {
    const lines = buildReadinessLines(false, undefined, 'Lefthook', 'biome', {
      label: 'tsc --noEmit',
    });
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0]).toContain('not detected');
  });

  it('returns lines when hook manager is missing', () => {
    const lines = buildReadinessLines(true, 'vitest', undefined, 'biome', {
      label: 'tsc --noEmit',
    });
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[1]).toContain('not detected');
  });

  it('returns lines when typecheck is unresolvable', () => {
    const lines = buildReadinessLines(true, 'vitest', 'Lefthook', 'biome', {
      reason: 'no tsconfig',
    });
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[3]).toContain('needs root tsconfig');
  });

  it('shows linter as dim when not detected', () => {
    const lines = buildReadinessLines(false, undefined, undefined, undefined, { reason: 'none' });
    expect(lines[2]).toContain('none');
  });
});

describe('promptPrereqs', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows readiness note when items are missing', async () => {
    selectMock.mockResolvedValueOnce('skip');
    await promptPrereqs('/test', makeScanResult(true), undefined, 'pnpm', false);
    expect(noteMock).toHaveBeenCalledWith(expect.any(String), 'Project readiness');
  });

  it('skips test runner prompt when already installed', async () => {
    selectMock.mockResolvedValueOnce('skip');
    const result = await promptPrereqs('/test', makeScanResult(true), undefined, 'pnpm', false);
    expect(result.hasTestRunner).toBe(true);
    expect(result.skipCoverage).toBe(false);
  });

  it('skips hook manager prompt when already installed', async () => {
    selectMock.mockResolvedValueOnce('skip');
    const result = await promptPrereqs('/test', makeScanResult(false), 'lefthook', 'pnpm', false);
    expect(result.hookManager).toBe('lefthook');
    expect(result.skipHooks).toBe(false);
    expect(result.skipCoverage).toBe(true);
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
    selectMock.mockResolvedValueOnce('install');
    const result = await promptPrereqs('/test', makeScanResult(false), 'lefthook', 'pnpm', false);
    expect(result.hasTestRunner).toBe(true);
    expect(result.skipCoverage).toBe(false);
  });

  it('returns typecheckLabel from resolution', async () => {
    const { resolveTypecheckCommand } = await import('../commands/resolve-typecheck.js');
    vi.mocked(resolveTypecheckCommand).mockReturnValueOnce({
      label: 'turbo typecheck',
      command: 'npx turbo typecheck',
    });
    const result = await promptPrereqs('/test', makeScanResult(true), 'lefthook', 'pnpm', false);
    expect(result.typecheckLabel).toBe('turbo typecheck');
  });

  it('returns undefined typecheckLabel when unresolvable', async () => {
    selectMock.mockResolvedValueOnce('skip');
    const result = await promptPrereqs('/test', makeScanResult(true), undefined, 'pnpm', false);
    expect(result.typecheckLabel).toBeUndefined();
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
