import type { PackageConfig } from '@viberails/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  confirm,
  confirmDangerous,
  promptInitDecision,
  promptIntegrations,
  promptRuleMenu,
} from './prompt.js';

const { selectMock, textMock, confirmMock, multiselectMock, noteMock, logMock, isCancelMock } =
  vi.hoisted(() => ({
    selectMock: vi.fn(),
    textMock: vi.fn(),
    confirmMock: vi.fn(),
    multiselectMock: vi.fn(),
    noteMock: vi.fn(),
    logMock: { info: vi.fn() },
    isCancelMock: vi.fn((value: unknown) => value === '__cancel__'),
  }));

vi.mock('@clack/prompts', () => ({
  select: selectMock,
  text: textMock,
  confirm: confirmMock,
  multiselect: multiselectMock,
  note: noteMock,
  log: logMock,
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
    logMock.info.mockReset();
    isCancelMock.mockClear();
  });

  it('promptInitDecision returns the selected choice', async () => {
    selectMock.mockResolvedValueOnce('customize');
    await expect(promptInitDecision()).resolves.toBe('customize');
  });

  it('promptInitDecision shows "Let me customize rules" label', async () => {
    selectMock.mockResolvedValueOnce('accept');
    await promptInitDecision();
    const options = selectMock.mock.calls[0][0].options;
    expect(options[1].label).toBe('Let me customize rules');
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
      githubAction: false,
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
      coverageSummaryPath: 'coverage/coverage-summary.json',
    });

    expect(result).toEqual({
      maxFileLines: 250,
      testCoverage: 90,
      enforceNaming: true,
      fileNamingValue: 'kebab-case',
      coverageSummaryPath: 'coverage/coverage-summary.json',
      coverageCommand: undefined,
      packageOverrides: undefined,
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
      coverageSummaryPath: 'coverage/coverage-summary.json',
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

    selectMock
      .mockResolvedValueOnce('packageOverrides')
      .mockResolvedValueOnce('__done__')
      .mockResolvedValueOnce('done');

    await promptRuleMenu({
      maxFileLines: 300,
      testCoverage: 80,
      enforceNaming: true,
      fileNamingValue: 'kebab-case',
      coverageSummaryPath: 'coverage/coverage-summary.json',
      packageOverrides: packages,
    });

    expect(noteMock).toHaveBeenCalledTimes(1);
    const [message] = noteMock.mock.calls[0];
    expect(message).toContain('apps/mobile');
    expect(message).toContain('fileNaming: PascalCase');
    expect(message).not.toContain('packages/same');
  });

  it('promptRuleMenu updates coverage defaults', async () => {
    selectMock
      .mockResolvedValueOnce('coverageSummaryPath')
      .mockResolvedValueOnce('coverageCommand')
      .mockResolvedValueOnce('done');
    textMock
      .mockResolvedValueOnce('artifacts/coverage-summary.json')
      .mockResolvedValueOnce('pnpm test:coverage');

    const result = await promptRuleMenu({
      maxFileLines: 300,
      testCoverage: 80,
      enforceNaming: true,
      fileNamingValue: 'kebab-case',
      coverageSummaryPath: 'coverage/coverage-summary.json',
    });

    expect(result.coverageSummaryPath).toBe('artifacts/coverage-summary.json');
    expect(result.coverageCommand).toBe('pnpm test:coverage');
  });

  it('promptRuleMenu edits per-package coverage overrides', async () => {
    const packages: PackageConfig[] = [
      { name: 'root', path: '.' },
      { name: 'web', path: 'apps/web' },
    ];

    selectMock
      // main menu
      .mockResolvedValueOnce('packageOverrides')
      // package selector
      .mockResolvedValueOnce('apps/web')
      // package edit menu
      .mockResolvedValueOnce('testCoverage')
      .mockResolvedValueOnce('summaryPath')
      .mockResolvedValueOnce('command')
      .mockResolvedValueOnce('back')
      // package selector done
      .mockResolvedValueOnce('__done__')
      // main menu done
      .mockResolvedValueOnce('done');

    textMock
      .mockResolvedValueOnce('0')
      .mockResolvedValueOnce('custom/coverage-summary.json')
      .mockResolvedValueOnce('pnpm --filter @app/web test:coverage');

    const result = await promptRuleMenu({
      maxFileLines: 300,
      testCoverage: 80,
      enforceNaming: true,
      coverageSummaryPath: 'coverage/coverage-summary.json',
      packageOverrides: packages,
    });

    const web = result.packageOverrides?.find((pkg) => pkg.path === 'apps/web');
    expect(web?.rules?.testCoverage).toBe(0);
    expect(web?.coverage?.summaryPath).toBe('custom/coverage-summary.json');
    expect(web?.coverage?.command).toBe('pnpm --filter @app/web test:coverage');
  });

  it('promptRuleMenu resets to detected defaults', async () => {
    selectMock
      .mockResolvedValueOnce('maxFileLines')
      .mockResolvedValueOnce('reset')
      .mockResolvedValueOnce('done');
    textMock.mockResolvedValueOnce('100');

    const result = await promptRuleMenu({
      maxFileLines: 300,
      testCoverage: 80,
      enforceNaming: true,
      fileNamingValue: 'kebab-case',
      coverageSummaryPath: 'coverage/coverage-summary.json',
    });

    expect(result.maxFileLines).toBe(300);
    expect(logMock.info).toHaveBeenCalledWith('Reset all rules to detected defaults.');
  });
});
