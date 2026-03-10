import type { PackageConfig } from '@viberails/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { promptPackageOverrides } from './prompt-package-overrides.js';

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

const defaults = {
  fileNamingValue: 'kebab-case',
  maxFileLines: 300,
  testCoverage: 80,
  coverageSummaryPath: 'coverage/coverage-summary.json',
};

describe('promptPackageOverrides', () => {
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

    const result = await promptPackageOverrides(packages, defaults);
    expect(result).toEqual(packages);
  });

  it('returns original packages when no editable packages exist', async () => {
    const packages: PackageConfig[] = [{ name: 'root', path: '.' }];

    const result = await promptPackageOverrides(packages, defaults);
    expect(result).toEqual(packages);
  });

  it('resets package overrides to inherit defaults', async () => {
    const packages: PackageConfig[] = [
      { name: 'root', path: '.' },
      {
        name: 'web',
        path: 'apps/web',
        rules: { testCoverage: 50, maxFileLines: 500 },
        coverage: { summaryPath: 'custom.json' },
        conventions: { fileNaming: 'camelCase' },
      },
    ];

    selectMock
      .mockResolvedValueOnce('apps/web')
      .mockResolvedValueOnce('reset')
      .mockResolvedValueOnce('back')
      .mockResolvedValueOnce('__done__');

    const result = await promptPackageOverrides(packages, defaults);

    const web = result.find((pkg) => pkg.path === 'apps/web');
    expect(web?.rules?.testCoverage).toBeUndefined();
    expect(web?.rules?.maxFileLines).toBeUndefined();
    expect(web?.coverage).toBeUndefined();
    expect(web?.conventions).toBeUndefined();
  });

  it('sets per-package naming convention', async () => {
    const packages: PackageConfig[] = [
      { name: 'root', path: '.' },
      { name: 'web', path: 'apps/web' },
    ];

    selectMock
      .mockResolvedValueOnce('apps/web')
      .mockResolvedValueOnce('fileNaming')
      .mockResolvedValueOnce('PascalCase')
      .mockResolvedValueOnce('back')
      .mockResolvedValueOnce('__done__');

    const result = await promptPackageOverrides(packages, defaults);

    const web = result.find((pkg) => pkg.path === 'apps/web');
    expect(web?.conventions?.fileNaming).toBe('PascalCase');
  });

  it('clears naming override when inherit is selected', async () => {
    const packages: PackageConfig[] = [
      { name: 'root', path: '.' },
      {
        name: 'web',
        path: 'apps/web',
        conventions: { fileNaming: 'camelCase' },
      },
    ];

    selectMock
      .mockResolvedValueOnce('apps/web')
      .mockResolvedValueOnce('fileNaming')
      .mockResolvedValueOnce('__inherit__')
      .mockResolvedValueOnce('back')
      .mockResolvedValueOnce('__done__');

    const result = await promptPackageOverrides(packages, defaults);

    const web = result.find((pkg) => pkg.path === 'apps/web');
    expect(web?.conventions?.fileNaming).toBeUndefined();
  });
});
