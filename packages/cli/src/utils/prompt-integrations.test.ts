import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildLefthookInstallCommand,
  promptIntegrations,
  promptIntegrationsDeferred,
} from './prompt-integrations.js';

const { multiselectMock, selectMock, isCancelMock, spinnerMock } = vi.hoisted(() => ({
  multiselectMock: vi.fn(),
  selectMock: vi.fn(),
  isCancelMock: vi.fn((value: unknown) => value === '__cancel__'),
  spinnerMock: { start: vi.fn(), stop: vi.fn() },
}));

vi.mock('@clack/prompts', () => ({
  multiselect: multiselectMock,
  select: selectMock,
  cancel: vi.fn(),
  isCancel: isCancelMock,
  spinner: () => spinnerMock,
  log: { warn: vi.fn(), info: vi.fn() },
}));

vi.mock('./spawn-async.js', () => ({
  spawnAsync: vi.fn(() => Promise.resolve({ status: 1, stdout: '', stderr: '' })),
}));

describe('promptIntegrations', () => {
  beforeEach(() => {
    multiselectMock.mockReset();
    selectMock.mockReset();
    isCancelMock.mockClear();
  });

  it('maps selected values to booleans', async () => {
    multiselectMock.mockResolvedValueOnce(['preCommit', 'claudeMd', 'githubAction']);
    const result = await promptIntegrations('/tmp/test', 'Lefthook');
    expect(result).toEqual({
      preCommitHook: true,
      claudeCodeHook: false,
      claudeMdRef: true,
      githubAction: true,
      typecheckHook: false,
      lintHook: false,
    });
  });

  it('uses hook manager name in label', async () => {
    multiselectMock.mockResolvedValueOnce([]);
    await promptIntegrations('/tmp/test', 'Husky');
    expect(multiselectMock.mock.calls[0][0].options[0].label).toContain('Husky');
  });

  it('prompts to install lefthook when no manager detected', async () => {
    selectMock.mockResolvedValueOnce('skip');
    multiselectMock.mockResolvedValueOnce([]);
    await promptIntegrations('/tmp/test', undefined);
    expect(selectMock).toHaveBeenCalledOnce();
    expect(selectMock.mock.calls[0][0].message).toContain('No shared git hook manager');
  });

  it('defaults pre-commit to disabled when user skips lefthook install', async () => {
    selectMock.mockResolvedValueOnce('skip');
    multiselectMock.mockResolvedValueOnce([]);
    await promptIntegrations('/tmp/test', undefined);
    const opts = multiselectMock.mock.calls[0][0];
    expect(opts.options[0].label).toContain('local only');
    expect(opts.initialValues).not.toContain('preCommit');
  });

  it('skips lefthook prompt when hook manager exists', async () => {
    multiselectMock.mockResolvedValueOnce([]);
    await promptIntegrations('/tmp/test', 'Lefthook');
    expect(selectMock).not.toHaveBeenCalled();
  });

  it('exits gracefully when user cancels at multiselect', async () => {
    multiselectMock.mockResolvedValueOnce('__cancel__');
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit');
    });
    await expect(promptIntegrations('/tmp/test', 'Lefthook')).rejects.toThrow('exit');
    expect(exitSpy).toHaveBeenCalledWith(0);
    exitSpy.mockRestore();
  });

  it('uses optional integrations message', async () => {
    multiselectMock.mockResolvedValueOnce([]);
    await promptIntegrations('/tmp/test', 'Lefthook');
    expect(multiselectMock.mock.calls[0][0].message).toBe('Optional integrations');
  });
});

describe('buildLefthookInstallCommand', () => {
  it('returns correct command for pnpm workspace', () => {
    expect(buildLefthookInstallCommand('pnpm', true)).toBe('pnpm add -D -w lefthook');
  });

  it('returns correct command for pnpm non-workspace', () => {
    expect(buildLefthookInstallCommand('pnpm', false)).toBe('pnpm add -D lefthook');
  });

  it('returns correct command for yarn', () => {
    expect(buildLefthookInstallCommand('yarn')).toBe('yarn add -D lefthook');
  });

  it('returns correct command for npm', () => {
    expect(buildLefthookInstallCommand('npm')).toBe('npm install -D lefthook');
  });
});

describe('promptIntegrationsDeferred', () => {
  beforeEach(() => {
    multiselectMock.mockReset();
  });

  it('includes installLefthook option when no hook manager', async () => {
    multiselectMock.mockResolvedValueOnce(['installLefthook', 'preCommit']);
    const result = await promptIntegrationsDeferred(undefined, undefined, 'pnpm', false);
    const opts = multiselectMock.mock.calls[0][0].options;
    expect(opts[0].value).toBe('installLefthook');
    expect(result.lefthookInstall).toBeDefined();
    expect(result.lefthookInstall?.command).toBe('pnpm add -D lefthook');
    expect(result.choice.preCommitHook).toBe(true);
  });

  it('omits installLefthook when hook manager exists', async () => {
    multiselectMock.mockResolvedValueOnce(['preCommit']);
    const result = await promptIntegrationsDeferred('Lefthook');
    const opts = multiselectMock.mock.calls[0][0].options;
    expect(opts.find((o: { value: string }) => o.value === 'installLefthook')).toBeUndefined();
    expect(result.lefthookInstall).toBeUndefined();
  });

  it('returns no lefthookInstall when user deselects it', async () => {
    multiselectMock.mockResolvedValueOnce(['preCommit']);
    const result = await promptIntegrationsDeferred(undefined, undefined, 'npm');
    expect(result.lefthookInstall).toBeUndefined();
  });
});
