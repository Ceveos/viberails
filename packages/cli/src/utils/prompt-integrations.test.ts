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

  it('does not include installLefthook option', async () => {
    multiselectMock.mockResolvedValueOnce(['preCommit']);
    await promptIntegrationsDeferred(undefined);
    const opts = multiselectMock.mock.calls[0][0].options;
    expect(opts.find((o: { value: string }) => o.value === 'installLefthook')).toBeUndefined();
  });

  it('labels pre-commit with hook manager name when present', async () => {
    multiselectMock.mockResolvedValueOnce(['preCommit']);
    await promptIntegrationsDeferred('Lefthook');
    const opts = multiselectMock.mock.calls[0][0].options;
    const preCommit = opts.find((o: { value: string }) => o.value === 'preCommit');
    expect(preCommit?.label).toBe('Pre-commit hook (Lefthook)');
    expect(preCommit?.hint).toBe('runs viberails checks when you commit');
  });

  it('labels pre-commit without hook manager name when absent', async () => {
    multiselectMock.mockResolvedValueOnce([]);
    await promptIntegrationsDeferred(undefined);
    const opts = multiselectMock.mock.calls[0][0].options;
    const preCommit = opts.find((o: { value: string }) => o.value === 'preCommit');
    expect(preCommit?.label).toBe('Pre-commit hook');
    expect(preCommit?.hint).toContain('local hook only');
  });

  it('default-checks preCommit when hook manager exists', async () => {
    multiselectMock.mockResolvedValueOnce(['preCommit']);
    await promptIntegrationsDeferred('Lefthook');
    const initialValues = multiselectMock.mock.calls[0][0].initialValues;
    expect(initialValues).toContain('preCommit');
  });

  it('default-unchecks preCommit when no hook manager', async () => {
    multiselectMock.mockResolvedValueOnce([]);
    await promptIntegrationsDeferred(undefined);
    const initialValues = multiselectMock.mock.calls[0][0].initialValues;
    expect(initialValues).not.toContain('preCommit');
  });

  it('includes typecheck option with resolved label', async () => {
    multiselectMock.mockResolvedValueOnce(['typecheck']);
    await promptIntegrationsDeferred('Lefthook', { typecheckLabel: 'turbo typecheck' });
    const opts = multiselectMock.mock.calls[0][0].options;
    const tc = opts.find((o: { value: string }) => o.value === 'typecheck');
    expect(tc).toBeDefined();
    expect(tc?.label).toBe('Typecheck (turbo typecheck)');
  });

  it('shows typecheck unchecked with hint when TS but no label', async () => {
    multiselectMock.mockResolvedValueOnce([]);
    await promptIntegrationsDeferred('Lefthook', { isTypeScript: true });
    const opts = multiselectMock.mock.calls[0][0].options;
    const tc = opts.find((o: { value: string }) => o.value === 'typecheck');
    expect(tc).toBeDefined();
    expect(tc?.label).toBe('Typecheck');
    expect(tc?.hint).toContain('needs root tsconfig');
    const initialValues = multiselectMock.mock.calls[0][0].initialValues;
    expect(initialValues).not.toContain('typecheck');
  });

  it('default-checks typecheck when label is resolved', async () => {
    multiselectMock.mockResolvedValueOnce(['typecheck']);
    await promptIntegrationsDeferred('Lefthook', { typecheckLabel: 'tsc --noEmit' });
    const initialValues = multiselectMock.mock.calls[0][0].initialValues;
    expect(initialValues).toContain('typecheck');
  });

  it('includes lint option when linter detected', async () => {
    multiselectMock.mockResolvedValueOnce(['lint']);
    await promptIntegrationsDeferred('Lefthook', { linter: 'biome' });
    const opts = multiselectMock.mock.calls[0][0].options;
    const lint = opts.find((o: { value: string }) => o.value === 'lint');
    expect(lint?.label).toContain('Biome');
  });

  it('returns correct choice flags', async () => {
    multiselectMock.mockResolvedValueOnce(['preCommit', 'claude', 'githubAction']);
    const result = await promptIntegrationsDeferred('Lefthook');
    expect(result.choice.preCommitHook).toBe(true);
    expect(result.choice.claudeCodeHook).toBe(true);
    expect(result.choice.claudeMdRef).toBe(false);
    expect(result.choice.githubAction).toBe(true);
  });
});
