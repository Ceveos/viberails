import { beforeEach, describe, expect, it, vi } from 'vitest';
import { promptIntegrations } from './prompt-integrations.js';

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
    expect(selectMock.mock.calls[0][0].message).toContain('No git hook manager');
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
});
