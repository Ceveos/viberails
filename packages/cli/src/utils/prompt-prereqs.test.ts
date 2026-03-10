import type { ScanResult } from '@viberails/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildReadinessNote, promptPrereqs } from './prompt-prereqs.js';

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

describe('buildReadinessNote', () => {
  it('shows ok icons for detected items', () => {
    const note = buildReadinessNote({
      testRunner: { status: 'ok', label: 'vitest' },
      hookManager: { status: 'ok', label: 'Lefthook' },
      linter: { status: 'ok', label: 'Biome' },
      typecheck: { status: 'ok', label: 'tsc --noEmit' },
    });
    expect(note).toContain('vitest');
    expect(note).toContain('Lefthook');
    expect(note).toContain('Biome');
    expect(note).toContain('tsc --noEmit');
  });

  it('shows skipped status for skipped items', () => {
    const note = buildReadinessNote({
      testRunner: { status: 'skipped' },
      hookManager: { status: 'skipped' },
      linter: { status: 'none' },
      typecheck: { status: 'skipped' },
    });
    expect(note).toContain('skipped');
  });

  it('shows missing status for undetected items', () => {
    const note = buildReadinessNote({
      testRunner: { status: 'missing' },
      hookManager: { status: 'missing' },
      linter: { status: 'none' },
      typecheck: { status: 'missing' },
    });
    expect(note).toContain('not detected');
    expect(note).toContain('needs root tsconfig');
  });
});

describe('promptPrereqs', () => {
  beforeEach(() => vi.clearAllMocks());

  it('skips readiness screen when everything detected', async () => {
    const { resolveTypecheckCommand } = await import('../commands/resolve-typecheck.js');
    vi.mocked(resolveTypecheckCommand).mockReturnValueOnce({
      label: 'tsc --noEmit',
      command: 'npx tsc --noEmit',
    });
    const result = await promptPrereqs('/test', makeScanResult(true), 'lefthook', 'pnpm', false);
    expect(noteMock).not.toHaveBeenCalled();
    expect(selectMock).not.toHaveBeenCalled();
    expect(result.hasTestRunner).toBe(true);
    expect(result.hookManager).toBe('lefthook');
    expect(result.typecheckLabel).toBe('tsc --noEmit');
  });

  it('shows readiness note before each missing item prompt', async () => {
    // Missing: test runner, hook manager, typecheck
    selectMock
      .mockResolvedValueOnce('skip') // test runner
      .mockResolvedValueOnce('skip') // hook manager
      .mockResolvedValueOnce('continue'); // typecheck
    await promptPrereqs('/test', makeScanResult(false), undefined, 'pnpm', false);
    // Should show note 3 times (once per missing item)
    expect(noteMock).toHaveBeenCalledTimes(3);
    expect(noteMock).toHaveBeenCalledWith(expect.any(String), 'Project readiness');
  });

  it('re-renders note with updated status after install', async () => {
    // Install test runner, then skip hook manager, then continue typecheck
    selectMock
      .mockResolvedValueOnce('install') // test runner → install
      .mockResolvedValueOnce('skip') // hook manager → skip
      .mockResolvedValueOnce('continue'); // typecheck → continue
    await promptPrereqs('/test', makeScanResult(false), undefined, 'pnpm', false);
    // Second note call (hook manager) should show test runner as resolved
    const secondNote = noteMock.mock.calls[1][0];
    expect(secondNote).toContain('vitest');
  });

  it('sets skipCoverage when user skips test runner', async () => {
    selectMock
      .mockResolvedValueOnce('skip') // test runner
      .mockResolvedValueOnce('skip') // hook manager
      .mockResolvedValueOnce('continue'); // typecheck
    const result = await promptPrereqs('/test', makeScanResult(false), undefined, 'pnpm', false);
    expect(result.skipCoverage).toBe(true);
    expect(result.hasTestRunner).toBe(false);
  });

  it('sets skipHooks when user skips hook manager', async () => {
    // typecheck still missing
    selectMock
      .mockResolvedValueOnce('skip') // hook manager
      .mockResolvedValueOnce('continue'); // typecheck
    const result = await promptPrereqs('/test', makeScanResult(true), undefined, 'pnpm', false);
    expect(result.skipHooks).toBe(true);
  });

  it('installs vitest when user chooses install', async () => {
    selectMock
      .mockResolvedValueOnce('install') // test runner
      .mockResolvedValueOnce('continue'); // typecheck
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
    selectMock
      .mockResolvedValueOnce('skip') // hook manager
      .mockResolvedValueOnce('continue'); // typecheck
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

  it('exits when user selects exit on typecheck prompt', async () => {
    selectMock
      .mockResolvedValueOnce('skip') // hook manager
      .mockResolvedValueOnce('exit'); // typecheck
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit');
    });
    await expect(
      promptPrereqs('/test', makeScanResult(true), undefined, 'pnpm', false),
    ).rejects.toThrow('exit');
    expect(exitSpy).toHaveBeenCalledWith(0);
    exitSpy.mockRestore();
  });
});
