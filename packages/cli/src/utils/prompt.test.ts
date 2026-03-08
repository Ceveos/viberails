import type { PackageConfig } from '@viberails/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  confirm,
  confirmDangerous,
  promptInitDecision,
  promptIntegrations,
  promptRuleMenu,
} from './prompt.js';

const { selectMock, textMock, confirmMock, multiselectMock, noteMock, isCancelMock } = vi.hoisted(
  () => ({
    selectMock: vi.fn(),
    textMock: vi.fn(),
    confirmMock: vi.fn(),
    multiselectMock: vi.fn(),
    noteMock: vi.fn(),
    isCancelMock: vi.fn((value: unknown) => value === '__cancel__'),
  }),
);

vi.mock('@clack/prompts', () => ({
  select: selectMock,
  text: textMock,
  confirm: confirmMock,
  multiselect: multiselectMock,
  note: noteMock,
  cancel: vi.fn(),
  isCancel: isCancelMock,
}));

describe('prompt utils', () => {
  beforeEach(() => {
    selectMock.mockReset();
    textMock.mockReset();
    confirmMock.mockReset();
    multiselectMock.mockReset();
    noteMock.mockReset();
    isCancelMock.mockClear();
  });

  it('promptInitDecision returns the selected choice', async () => {
    selectMock.mockResolvedValueOnce('customize');
    await expect(promptInitDecision()).resolves.toBe('customize');
  });

  it('confirm and confirmDangerous use different default values', async () => {
    confirmMock.mockResolvedValueOnce(true);
    await confirm('Continue?');
    expect(confirmMock).toHaveBeenCalledWith({ message: 'Continue?', initialValue: true });

    confirmMock.mockResolvedValueOnce(false);
    await confirmDangerous('Apply?');
    expect(confirmMock).toHaveBeenCalledWith({ message: 'Apply?', initialValue: false });
  });

  it('promptIntegrations maps selected values to booleans', async () => {
    multiselectMock.mockResolvedValueOnce(['preCommit', 'claudeMd']);
    const result = await promptIntegrations('Lefthook');
    expect(result).toEqual({
      preCommitHook: true,
      claudeCodeHook: false,
      claudeMdRef: true,
    });
  });

  it('promptRuleMenu updates maxFileLines and testCoverage', async () => {
    selectMock
      .mockResolvedValueOnce('maxFileLines')
      .mockResolvedValueOnce('testCoverage')
      .mockResolvedValueOnce('done');
    textMock.mockResolvedValueOnce('250').mockResolvedValueOnce('90');

    const result = await promptRuleMenu({
      maxFileLines: 300,
      testCoverage: 80,
      enforceNaming: true,
      fileNamingValue: 'kebab-case',
    });

    expect(result).toEqual({
      maxFileLines: 250,
      testCoverage: 90,
      enforceNaming: true,
      fileNamingValue: 'kebab-case',
    });
  });

  it('promptRuleMenu lets user override file naming convention', async () => {
    selectMock
      .mockResolvedValueOnce('fileNaming')
      .mockResolvedValueOnce('snake_case')
      .mockResolvedValueOnce('done');

    const result = await promptRuleMenu({
      maxFileLines: 300,
      testCoverage: 80,
      enforceNaming: true,
      fileNamingValue: 'kebab-case',
    });

    expect(result.fileNamingValue).toBe('snake_case');
  });

  it('promptRuleMenu shows only package differences against root defaults', async () => {
    const packages: PackageConfig[] = [
      {
        name: 'root',
        path: '.',
        stack: { language: 'typescript', packageManager: 'pnpm' },
        conventions: { fileNaming: 'kebab-case' },
      },
      {
        name: 'same',
        path: 'packages/same',
        stack: { language: 'typescript', packageManager: 'pnpm' },
        conventions: { fileNaming: 'kebab-case' },
      },
      {
        name: 'mobile',
        path: 'apps/mobile',
        stack: { language: 'typescript', packageManager: 'pnpm', framework: 'expo@53' },
        conventions: { fileNaming: 'PascalCase' },
      },
    ];

    selectMock.mockResolvedValueOnce('packageOverrides').mockResolvedValueOnce('done');

    await promptRuleMenu({
      maxFileLines: 300,
      testCoverage: 80,
      enforceNaming: true,
      fileNamingValue: 'kebab-case',
      packageOverrides: packages,
    });

    expect(noteMock).toHaveBeenCalledTimes(1);
    const [message] = noteMock.mock.calls[0];
    expect(message).toContain('apps/mobile');
    expect(message).toContain('fileNaming: PascalCase');
    expect(message).not.toContain('packages/same');
  });
});
