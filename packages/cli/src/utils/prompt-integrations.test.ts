import { beforeEach, describe, expect, it, vi } from 'vitest';
import { promptIntegrations } from './prompt-integrations.js';

const { multiselectMock, isCancelMock } = vi.hoisted(() => ({
  multiselectMock: vi.fn(),
  isCancelMock: vi.fn((value: unknown) => value === '__cancel__'),
}));

vi.mock('@clack/prompts', () => ({
  multiselect: multiselectMock,
  cancel: vi.fn(),
  isCancel: isCancelMock,
}));

describe('promptIntegrations', () => {
  beforeEach(() => {
    multiselectMock.mockReset();
    isCancelMock.mockClear();
  });

  it('maps selected values to booleans', async () => {
    multiselectMock.mockResolvedValueOnce(['preCommit', 'claudeMd', 'githubAction']);
    const result = await promptIntegrations('Lefthook');
    expect(result).toEqual({
      preCommitHook: true,
      claudeCodeHook: false,
      claudeMdRef: true,
      githubAction: true,
    });
  });

  it('uses hook manager name in label', async () => {
    multiselectMock.mockResolvedValueOnce([]);
    await promptIntegrations('Husky');
    expect(multiselectMock.mock.calls[0][0].options[0].label).toContain('Husky');
  });

  it('falls back to git hook when no manager detected', async () => {
    multiselectMock.mockResolvedValueOnce([]);
    await promptIntegrations(undefined);
    expect(multiselectMock.mock.calls[0][0].options[0].label).toContain('git hook');
  });
});
