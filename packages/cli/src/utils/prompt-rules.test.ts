import { beforeEach, describe, expect, it, vi } from 'vitest';
import { promptRuleMenu } from './prompt-rules.js';

const { selectMock, textMock, confirmMock, noteMock, logMock, isCancelMock } = vi.hoisted(() => ({
  selectMock: vi.fn(),
  textMock: vi.fn(),
  confirmMock: vi.fn(),
  noteMock: vi.fn(),
  logMock: { info: vi.fn() },
  isCancelMock: vi.fn((value: unknown) => value === '__cancel__'),
}));

vi.mock('@clack/prompts', () => ({
  select: selectMock,
  text: textMock,
  confirm: confirmMock,
  note: noteMock,
  log: logMock,
  cancel: vi.fn(),
  isCancel: isCancelMock,
}));

describe('promptRuleMenu', () => {
  beforeEach(() => {
    selectMock.mockReset();
    textMock.mockReset();
    confirmMock.mockReset();
    noteMock.mockReset();
    logMock.info.mockReset();
    isCancelMock.mockClear();
  });

  it('returns defaults when user selects done immediately', async () => {
    selectMock.mockResolvedValueOnce('done');

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
    expect(result.testCoverage).toBe(80);
    expect(result.enforceNaming).toBe(true);
  });

  it('shows coverage disabled in testing hint', async () => {
    selectMock.mockResolvedValueOnce('done');

    await promptRuleMenu({
      maxFileLines: 300,
      maxTestFileLines: 0,
      testCoverage: 0,
      enforceMissingTests: true,
      enforceNaming: true,
      coverageSummaryPath: 'coverage/coverage-summary.json',
    });

    const options = selectMock.mock.calls[0][0].options;
    const testingOption = options.find((o: { value: string }) => o.value === 'testing');
    expect(testingOption.hint).toContain('coverage disabled');
  });

  it('includes reset option in menu', async () => {
    selectMock.mockResolvedValueOnce('done');

    await promptRuleMenu({
      maxFileLines: 300,
      maxTestFileLines: 0,
      testCoverage: 80,
      enforceMissingTests: true,
      enforceNaming: true,
      coverageSummaryPath: 'coverage/coverage-summary.json',
    });

    const options = selectMock.mock.calls[0][0].options;
    const resetOption = options.find((o: { value: string }) => o.value === 'reset');
    expect(resetOption).toBeDefined();
    expect(resetOption.label).toBe('Reset all to detected defaults');
  });

  it('groups naming before testing in top-level menu', async () => {
    selectMock.mockResolvedValueOnce('done');

    await promptRuleMenu({
      maxFileLines: 300,
      maxTestFileLines: 0,
      testCoverage: 80,
      enforceMissingTests: true,
      enforceNaming: true,
      fileNamingValue: 'kebab-case',
      coverageSummaryPath: 'coverage/coverage-summary.json',
    });

    const options = selectMock.mock.calls[0][0].options;
    const values = options.map((o: { value: string }) => o.value);
    const namingIdx = values.indexOf('naming');
    const testingIdx = values.indexOf('testing');
    expect(namingIdx).toBeLessThan(testingIdx);
  });
});
