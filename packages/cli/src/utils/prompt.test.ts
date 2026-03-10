import type { PackageConfig } from '@viberails/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  confirm,
  confirmDangerous,
  promptExistingConfigAction,
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

  it('promptInitDecision shows review and customize options', async () => {
    selectMock.mockResolvedValueOnce('accept');
    await promptInitDecision();
    const options = selectMock.mock.calls[0][0].options;
    expect(options[1].label).toBe('Customize rules');
    expect(options[2].label).toBe('Review detected details');
  });

  it('confirm and confirmDangerous use different default values', async () => {
    confirmMock.mockResolvedValueOnce(true);
    await confirm('Continue?');
    expect(confirmMock).toHaveBeenCalledWith({ message: 'Continue?', initialValue: true });

    confirmMock.mockResolvedValueOnce(false);
    await confirmDangerous('Apply?');
    expect(confirmMock).toHaveBeenCalledWith({ message: 'Apply?', initialValue: false });
  });

  it('promptExistingConfigAction offers edit, replace, and cancel', async () => {
    selectMock.mockResolvedValueOnce('edit');
    await expect(promptExistingConfigAction('viberails.config.json')).resolves.toBe('edit');
    const options = selectMock.mock.calls[0][0].options;
    expect(options[0].label).toBe('Edit existing config');
    expect(options[1].label).toBe('Replace with a fresh scan');
    expect(options[2].label).toBe('Cancel');
  });

  it('promptIntegrations maps selected values to booleans', async () => {
    multiselectMock.mockResolvedValueOnce(['preCommit', 'claudeMd']);
    const result = await promptIntegrations('/tmp/test', 'Lefthook');
    expect(result).toEqual({
      preCommitHook: true,
      claudeCodeHook: false,
      claudeMdRef: true,
      githubAction: false,
      typecheckHook: false,
      lintHook: false,
    });
  });

  it('promptIntegrations shows typecheck option when TypeScript is detected', async () => {
    multiselectMock.mockResolvedValueOnce(['preCommit', 'typecheck']);
    const result = await promptIntegrations('/tmp/test', 'Husky', { isTypeScript: true });
    expect(result.typecheckHook).toBe(true);
    const options = multiselectMock.mock.calls[0][0].options;
    expect(options.some((o: { value: string }) => o.value === 'typecheck')).toBe(true);
  });

  it('promptIntegrations shows lint option when linter is detected', async () => {
    multiselectMock.mockResolvedValueOnce(['lint']);
    const result = await promptIntegrations('/tmp/test', 'Lefthook', { linter: 'eslint' });
    expect(result.lintHook).toBe(true);
    const options = multiselectMock.mock.calls[0][0].options;
    expect(options.some((o: { value: string }) => o.value === 'lint')).toBe(true);
  });

  it('promptRuleMenu updates maxFileLines via file limits sub-menu', async () => {
    selectMock
      // main menu → file limits
      .mockResolvedValueOnce('fileLimits')
      // file limits sub-menu → max file lines
      .mockResolvedValueOnce('maxFileLines')
      // file limits sub-menu → back
      .mockResolvedValueOnce('back')
      // main menu → testing
      .mockResolvedValueOnce('testing')
      // testing sub-menu → test coverage
      .mockResolvedValueOnce('testCoverage')
      // testing sub-menu → back
      .mockResolvedValueOnce('back')
      // main menu → done
      .mockResolvedValueOnce('done');
    textMock.mockResolvedValueOnce('250').mockResolvedValueOnce('90');

    const result = await promptRuleMenu({
      maxFileLines: 300,
      maxTestFileLines: 0,
      testCoverage: 80,
      enforceMissingTests: true,
      enforceNaming: true,
      fileNamingValue: 'kebab-case',
      coverageSummaryPath: 'coverage/coverage-summary.json',
    });

    expect(result.maxFileLines).toBe(250);
    expect(result.testCoverage).toBe(90);
  });

  it('promptRuleMenu lets user override file naming via naming sub-menu', async () => {
    selectMock
      // main menu → naming
      .mockResolvedValueOnce('naming')
      // naming sub-menu → file naming
      .mockResolvedValueOnce('fileNaming')
      // naming select
      .mockResolvedValueOnce('snake_case')
      // naming sub-menu → back
      .mockResolvedValueOnce('back')
      // main menu → done
      .mockResolvedValueOnce('done');

    const result = await promptRuleMenu({
      maxFileLines: 300,
      maxTestFileLines: 0,
      testCoverage: 80,
      enforceMissingTests: true,
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
      maxTestFileLines: 0,
      testCoverage: 80,
      enforceMissingTests: true,
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

  it('promptRuleMenu updates coverage defaults via testing sub-menu', async () => {
    selectMock
      // main menu → testing
      .mockResolvedValueOnce('testing')
      // testing sub-menu
      .mockResolvedValueOnce('coverageSummaryPath')
      .mockResolvedValueOnce('coverageCommand')
      .mockResolvedValueOnce('back')
      // main menu → done
      .mockResolvedValueOnce('done');
    textMock
      .mockResolvedValueOnce('artifacts/coverage-summary.json')
      .mockResolvedValueOnce('pnpm test:coverage');

    const result = await promptRuleMenu({
      maxFileLines: 300,
      maxTestFileLines: 0,
      testCoverage: 80,
      enforceMissingTests: true,
      enforceNaming: true,
      fileNamingValue: 'kebab-case',
      coverageSummaryPath: 'coverage/coverage-summary.json',
    });

    expect(result.coverageSummaryPath).toBe('artifacts/coverage-summary.json');
    expect(result.coverageCommand).toBe('pnpm test:coverage');
  });

  it('promptRuleMenu edits per-package overrides', async () => {
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
      maxTestFileLines: 0,
      testCoverage: 80,
      enforceMissingTests: true,
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
      // main menu → file limits
      .mockResolvedValueOnce('fileLimits')
      // file limits → change max file lines
      .mockResolvedValueOnce('maxFileLines')
      // file limits → back
      .mockResolvedValueOnce('back')
      // main menu → reset
      .mockResolvedValueOnce('reset')
      // main menu → done
      .mockResolvedValueOnce('done');
    textMock.mockResolvedValueOnce('100');

    const result = await promptRuleMenu({
      maxFileLines: 300,
      maxTestFileLines: 0,
      testCoverage: 80,
      enforceMissingTests: true,
      enforceNaming: true,
      fileNamingValue: 'kebab-case',
      coverageSummaryPath: 'coverage/coverage-summary.json',
    });

    expect(result.maxFileLines).toBe(300);
    expect(logMock.info).toHaveBeenCalledWith('Reset all rules to detected defaults.');
  });
});
