import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SENTINEL_CLEAR, SENTINEL_CUSTOM } from './prompt-constants.js';
import type { RuleOverrides } from './prompt-rules.js';
import {
  COMPONENT_NAMING_OPTIONS,
  FILE_NAMING_OPTIONS,
  HOOK_NAMING_OPTIONS,
  promptFileLimitsMenu,
  promptNamingMenu,
  promptTestingMenu,
} from './prompt-submenus.js';

const { selectMock, textMock, confirmMock, isCancelMock } = vi.hoisted(() => ({
  selectMock: vi.fn(),
  textMock: vi.fn(),
  confirmMock: vi.fn(),
  isCancelMock: vi.fn((value: unknown) => value === '__cancel__'),
}));

vi.mock('@clack/prompts', () => ({
  select: selectMock,
  text: textMock,
  confirm: confirmMock,
  cancel: vi.fn(),
  isCancel: isCancelMock,
}));

function makeState(overrides: Partial<RuleOverrides> = {}): RuleOverrides {
  return {
    maxFileLines: 300,
    maxTestFileLines: 0,
    testCoverage: 80,
    enforceMissingTests: true,
    enforceNaming: true,
    fileNamingValue: 'kebab-case',
    coverageSummaryPath: 'coverage/coverage-summary.json',
    ...overrides,
  };
}

describe('FILE_NAMING_OPTIONS', () => {
  it('contains the four standard naming conventions', () => {
    const values = FILE_NAMING_OPTIONS.map((o) => o.value);
    expect(values).toEqual(['kebab-case', 'camelCase', 'PascalCase', 'snake_case']);
  });
});

describe('COMPONENT_NAMING_OPTIONS', () => {
  it('contains PascalCase and camelCase', () => {
    const values = COMPONENT_NAMING_OPTIONS.map((o) => o.value);
    expect(values).toEqual(['PascalCase', 'camelCase']);
  });

  it('hints show export names, not file names', () => {
    for (const opt of COMPONENT_NAMING_OPTIONS) {
      expect(opt.hint).not.toContain('.tsx');
      expect(opt.hint).not.toContain('.ts');
    }
  });
});

describe('HOOK_NAMING_OPTIONS', () => {
  it('contains useXxx and use-*', () => {
    const values = HOOK_NAMING_OPTIONS.map((o) => o.value);
    expect(values).toEqual(['useXxx', 'use-*']);
  });
});

describe('promptFileLimitsMenu', () => {
  beforeEach(() => {
    selectMock.mockReset();
    textMock.mockReset();
  });

  it('returns immediately when user selects back', async () => {
    selectMock.mockResolvedValueOnce('back');
    const state = makeState();
    await promptFileLimitsMenu(state);
    expect(state.maxFileLines).toBe(300);
  });

  it('updates maxFileLines via text input', async () => {
    selectMock.mockResolvedValueOnce('maxFileLines').mockResolvedValueOnce('back');
    textMock.mockResolvedValueOnce('250');
    const state = makeState();
    await promptFileLimitsMenu(state);
    expect(state.maxFileLines).toBe(250);
  });

  it('updates maxTestFileLines via text input', async () => {
    selectMock.mockResolvedValueOnce('maxTestFileLines').mockResolvedValueOnce('back');
    textMock.mockResolvedValueOnce('500');
    const state = makeState();
    await promptFileLimitsMenu(state);
    expect(state.maxTestFileLines).toBe(500);
  });
});

describe('promptNamingMenu', () => {
  beforeEach(() => {
    selectMock.mockReset();
    textMock.mockReset();
    confirmMock.mockReset();
  });

  it('returns immediately when user selects back', async () => {
    selectMock.mockResolvedValueOnce('back');
    const state = makeState();
    await promptNamingMenu(state);
    expect(state.enforceNaming).toBe(true);
  });

  it('toggles enforceNaming off', async () => {
    selectMock.mockResolvedValueOnce('toggleEnforcement').mockResolvedValueOnce('back');
    const state = makeState();
    await promptNamingMenu(state);
    expect(state.enforceNaming).toBe(false);
  });

  it('toggles enforceNaming on without auto-prompting', async () => {
    selectMock.mockResolvedValueOnce('toggleEnforcement').mockResolvedValueOnce('back');
    const state = makeState({ enforceNaming: false, fileNamingValue: undefined });
    await promptNamingMenu(state);
    expect(state.enforceNaming).toBe(true);
    expect(state.fileNamingValue).toBeUndefined();
    expect(selectMock).toHaveBeenCalledTimes(2);
  });

  it('updates fileNamingValue via naming option', async () => {
    selectMock
      .mockResolvedValueOnce('fileNaming')
      .mockResolvedValueOnce('PascalCase')
      .mockResolvedValueOnce('back');
    const state = makeState();
    await promptNamingMenu(state);
    expect(state.fileNamingValue).toBe('PascalCase');
  });

  it('selects PascalCase for componentNaming', async () => {
    selectMock
      .mockResolvedValueOnce('componentNaming')
      .mockResolvedValueOnce('PascalCase')
      .mockResolvedValueOnce('back');
    const state = makeState();
    await promptNamingMenu(state);
    expect(state.componentNaming).toBe('PascalCase');
  });

  it('clears componentNaming via Clear option', async () => {
    selectMock
      .mockResolvedValueOnce('componentNaming')
      .mockResolvedValueOnce(SENTINEL_CLEAR)
      .mockResolvedValueOnce('back');
    const state = makeState({ componentNaming: 'PascalCase' });
    await promptNamingMenu(state);
    expect(state.componentNaming).toBeUndefined();
  });

  it('selects useXxx for hookNaming', async () => {
    selectMock
      .mockResolvedValueOnce('hookNaming')
      .mockResolvedValueOnce('useXxx')
      .mockResolvedValueOnce('back');
    const state = makeState();
    await promptNamingMenu(state);
    expect(state.hookNaming).toBe('useXxx');
  });

  it('clears hookNaming via Clear option', async () => {
    selectMock
      .mockResolvedValueOnce('hookNaming')
      .mockResolvedValueOnce(SENTINEL_CLEAR)
      .mockResolvedValueOnce('back');
    const state = makeState({ hookNaming: 'useXxx' });
    await promptNamingMenu(state);
    expect(state.hookNaming).toBeUndefined();
  });

  it('selects @/* for importAlias', async () => {
    selectMock
      .mockResolvedValueOnce('importAlias')
      .mockResolvedValueOnce('@/*')
      .mockResolvedValueOnce('back');
    const state = makeState();
    await promptNamingMenu(state);
    expect(state.importAlias).toBe('@/*');
  });

  it('selects Custom and enters validated importAlias', async () => {
    selectMock
      .mockResolvedValueOnce('importAlias')
      .mockResolvedValueOnce(SENTINEL_CUSTOM)
      .mockResolvedValueOnce('back');
    textMock.mockResolvedValueOnce('#src/*');
    const state = makeState();
    await promptNamingMenu(state);
    expect(state.importAlias).toBe('#src/*');
  });

  it('clears importAlias via Clear option', async () => {
    selectMock
      .mockResolvedValueOnce('importAlias')
      .mockResolvedValueOnce(SENTINEL_CLEAR)
      .mockResolvedValueOnce('back');
    const state = makeState({ importAlias: '@/*' });
    await promptNamingMenu(state);
    expect(state.importAlias).toBeUndefined();
  });

  it('treats cancel as back', async () => {
    selectMock.mockResolvedValueOnce('__cancel__');
    const state = makeState();
    await promptNamingMenu(state);
    // State unchanged — cancel returns to parent without modifying anything
    expect(state.enforceNaming).toBe(true);
    expect(state.fileNamingValue).toBe('kebab-case');
  });
});

describe('promptFileLimitsMenu validators', () => {
  beforeEach(() => {
    selectMock.mockReset();
    textMock.mockReset();
  });

  it('maxFileLines validator rejects negative, non-numeric, and zero', async () => {
    selectMock.mockResolvedValueOnce('maxFileLines').mockResolvedValueOnce('back');
    textMock.mockResolvedValueOnce('100');
    const state = makeState();
    await promptFileLimitsMenu(state);

    const validate = textMock.mock.calls[0][0].validate;
    expect(validate('-1')).toBe('Enter a positive number');
    expect(validate('abc')).toBe('Enter a positive number');
    expect(validate('0')).toBe('Enter a positive number');
    expect(validate('100')).toBeUndefined();
  });

  it('testCoverage validator rejects >100, <0, and non-numeric', async () => {
    selectMock.mockResolvedValueOnce('testCoverage').mockResolvedValueOnce('back');
    textMock.mockResolvedValueOnce('80');
    const state = makeState();
    await promptTestingMenu(state);

    const validate = textMock.mock.calls[0][0].validate;
    expect(validate('101')).toBe('Enter a number between 0 and 100');
    expect(validate('-1')).toBe('Enter a number between 0 and 100');
    expect(validate('abc')).toBe('Enter a number between 0 and 100');
    expect(validate('50')).toBeUndefined();
  });
});

describe('promptNamingMenu importAlias validator', () => {
  beforeEach(() => {
    selectMock.mockReset();
    textMock.mockReset();
  });

  it('importAlias custom validator rejects empty and invalid patterns', async () => {
    selectMock
      .mockResolvedValueOnce('importAlias')
      .mockResolvedValueOnce(SENTINEL_CUSTOM)
      .mockResolvedValueOnce('back');
    textMock.mockResolvedValueOnce('#src/*');
    const state = makeState();
    await promptNamingMenu(state);

    const validate = textMock.mock.calls[0][0].validate;
    expect(validate('')).toBe('Alias cannot be empty');
    expect(validate('  ')).toBe('Alias cannot be empty');
    expect(validate('invalid')).toBe('Must match pattern like @/*, ~/*, or #src/*');
    expect(validate('@/*')).toBeUndefined();
  });
});

describe('promptTestingMenu', () => {
  beforeEach(() => {
    selectMock.mockReset();
    textMock.mockReset();
    confirmMock.mockReset();
  });

  it('returns immediately when user selects back', async () => {
    selectMock.mockResolvedValueOnce('back');
    const state = makeState();
    await promptTestingMenu(state);
    expect(state.testCoverage).toBe(80);
  });

  it('toggles enforceMissingTests', async () => {
    selectMock.mockResolvedValueOnce('enforceMissingTests').mockResolvedValueOnce('back');
    confirmMock.mockResolvedValueOnce(false);
    const state = makeState();
    await promptTestingMenu(state);
    expect(state.enforceMissingTests).toBe(false);
  });

  it('updates testCoverage via text input', async () => {
    selectMock.mockResolvedValueOnce('testCoverage').mockResolvedValueOnce('back');
    textMock.mockResolvedValueOnce('90');
    const state = makeState();
    await promptTestingMenu(state);
    expect(state.testCoverage).toBe(90);
  });

  it('updates coverageSummaryPath when coverage is enabled', async () => {
    selectMock.mockResolvedValueOnce('coverageSummaryPath').mockResolvedValueOnce('back');
    textMock.mockResolvedValueOnce('custom/path.json');
    const state = makeState();
    await promptTestingMenu(state);
    expect(state.coverageSummaryPath).toBe('custom/path.json');
  });

  it('updates coverageCommand', async () => {
    selectMock.mockResolvedValueOnce('coverageCommand').mockResolvedValueOnce('back');
    textMock.mockResolvedValueOnce('pnpm test:coverage');
    const state = makeState();
    await promptTestingMenu(state);
    expect(state.coverageCommand).toBe('pnpm test:coverage');
  });

  it('clears coverageCommand when blank input', async () => {
    selectMock.mockResolvedValueOnce('coverageCommand').mockResolvedValueOnce('back');
    textMock.mockResolvedValueOnce('  ');
    const state = makeState({ coverageCommand: 'old-command' });
    await promptTestingMenu(state);
    expect(state.coverageCommand).toBeUndefined();
  });

  it('hides coverage path and command when coverage is disabled', async () => {
    selectMock.mockResolvedValueOnce('back');
    const state = makeState({ testCoverage: 0 });
    await promptTestingMenu(state);
    const options = selectMock.mock.calls[0][0].options;
    const values = options.map((o: { value: string }) => o.value);
    expect(values).not.toContain('coverageSummaryPath');
    expect(values).not.toContain('coverageCommand');
  });
});
