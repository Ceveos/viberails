import type { PackageConfig } from '@viberails/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { promptPackageCoverageOverrides } from './prompt-package-overrides.js';

const { selectMock, textMock, isCancelMock } = vi.hoisted(() => ({
  selectMock: vi.fn(),
  textMock: vi.fn(),
  isCancelMock: vi.fn((value: unknown) => value === '__cancel__'),
}));

vi.mock('@clack/prompts', () => ({
  select: selectMock,
  text: textMock,
  cancel: vi.fn(),
  isCancel: isCancelMock,
}));

describe('promptPackageCoverageOverrides', () => {
  beforeEach(() => {
    selectMock.mockReset();
    textMock.mockReset();
    isCancelMock.mockClear();
  });

  it('returns unchanged packages when user selects done immediately', async () => {
    const packages: PackageConfig[] = [
      { name: 'root', path: '.' },
      { name: 'web', path: 'apps/web' },
    ];

    selectMock.mockResolvedValueOnce('__done__');

    const result = await promptPackageCoverageOverrides(packages, {
      testCoverage: 80,
      coverageSummaryPath: 'coverage/coverage-summary.json',
    });

    expect(result).toEqual(packages);
  });

  it('returns original packages when no editable packages exist', async () => {
    const packages: PackageConfig[] = [{ name: 'root', path: '.' }];

    const result = await promptPackageCoverageOverrides(packages, {
      testCoverage: 80,
      coverageSummaryPath: 'coverage/coverage-summary.json',
    });

    expect(result).toEqual(packages);
  });

  it('resets package overrides to inherit defaults', async () => {
    const packages: PackageConfig[] = [
      { name: 'root', path: '.' },
      {
        name: 'web',
        path: 'apps/web',
        rules: { testCoverage: 50 },
        coverage: { summaryPath: 'custom.json' },
      },
    ];

    selectMock
      .mockResolvedValueOnce('apps/web')
      .mockResolvedValueOnce('reset')
      .mockResolvedValueOnce('back')
      .mockResolvedValueOnce('__done__');

    const result = await promptPackageCoverageOverrides(packages, {
      testCoverage: 80,
      coverageSummaryPath: 'coverage/coverage-summary.json',
    });

    const web = result.find((pkg) => pkg.path === 'apps/web');
    expect(web?.rules?.testCoverage).toBeUndefined();
    expect(web?.coverage).toBeUndefined();
  });
});
