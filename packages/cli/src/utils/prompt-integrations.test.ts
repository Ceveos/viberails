import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildLefthookInstallCommand, promptIntegrationsDeferred } from './prompt-integrations.js';

const { multiselectMock, isCancelMock } = vi.hoisted(() => ({
  multiselectMock: vi.fn(),
  isCancelMock: vi.fn((value: unknown) => value === '__cancel__'),
}));

vi.mock('@clack/prompts', () => ({
  multiselect: multiselectMock,
  cancel: vi.fn(),
  isCancel: isCancelMock,
}));

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
