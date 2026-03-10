import type { PackageConfig } from '@viberails/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SENTINEL_DONE, SENTINEL_INHERIT, SENTINEL_NONE } from './prompt-constants.js';
import {
  normalizePackageOverrides,
  packageOverrideHint,
  promptPackageOverrides,
} from './prompt-package-overrides.js';

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

describe('packageOverrideHint', () => {
  it('returns "(no overrides)" for package with no differences', () => {
    const pkg: PackageConfig = { name: '@scope/web', path: 'apps/web' };
    expect(packageOverrideHint(pkg, defaults)).toBe('(no overrides)');
  });

  it('shows naming override', () => {
    const pkg: PackageConfig = {
      name: '@scope/web',
      path: 'apps/web',
      conventions: { fileNaming: 'PascalCase' },
    };
    expect(packageOverrideHint(pkg, defaults)).toBe('PascalCase');
  });

  it('shows maxFileLines override', () => {
    const pkg: PackageConfig = {
      name: '@scope/web',
      path: 'apps/web',
      rules: { maxFileLines: 500 },
    };
    expect(packageOverrideHint(pkg, defaults)).toBe('500 lines');
  });

  it('shows "exempt" for testCoverage === 0', () => {
    const pkg: PackageConfig = {
      name: '@scope/web',
      path: 'apps/web',
      rules: { testCoverage: 0 },
    };
    expect(packageOverrideHint(pkg, defaults)).toBe('exempt');
  });

  it('shows "exempt (types-only)" for types packages with coverage 0', () => {
    const pkg: PackageConfig = {
      name: '@scope/types',
      path: 'packages/types',
      rules: { testCoverage: 0 },
    };
    expect(packageOverrideHint(pkg, defaults)).toBe('exempt (types-only)');
  });

  it('shows coverage percentage when different from default', () => {
    const pkg: PackageConfig = {
      name: '@scope/web',
      path: 'apps/web',
      rules: { testCoverage: 60 },
    };
    expect(packageOverrideHint(pkg, defaults)).toBe('60%');
  });

  it('shows "summary override" and "command override"', () => {
    const pkg: PackageConfig = {
      name: '@scope/web',
      path: 'apps/web',
      coverage: { summaryPath: 'custom.json', command: 'vitest run' },
    };
    expect(packageOverrideHint(pkg, defaults)).toBe('summary override, command override');
  });
});

describe('normalizePackageOverrides', () => {
  it('removes empty rules object', () => {
    const packages: PackageConfig[] = [{ name: 'web', path: 'apps/web', rules: {} }];
    normalizePackageOverrides(packages);
    expect(packages[0].rules).toBeUndefined();
  });

  it('removes empty coverage object', () => {
    const packages: PackageConfig[] = [{ name: 'web', path: 'apps/web', coverage: {} }];
    normalizePackageOverrides(packages);
    expect(packages[0].coverage).toBeUndefined();
  });

  it('removes empty conventions object', () => {
    const packages: PackageConfig[] = [{ name: 'web', path: 'apps/web', conventions: {} }];
    normalizePackageOverrides(packages);
    expect(packages[0].conventions).toBeUndefined();
  });

  it('preserves non-empty objects', () => {
    const packages: PackageConfig[] = [
      {
        name: 'web',
        path: 'apps/web',
        rules: { maxFileLines: 500 },
        conventions: { fileNaming: 'camelCase' },
        coverage: { summaryPath: 'custom.json' },
      },
    ];
    normalizePackageOverrides(packages);
    expect(packages[0].rules).toEqual({ maxFileLines: 500 });
    expect(packages[0].conventions).toEqual({ fileNaming: 'camelCase' });
    expect(packages[0].coverage).toEqual({ summaryPath: 'custom.json' });
  });
});

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

    selectMock.mockResolvedValueOnce(SENTINEL_DONE);

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
      .mockResolvedValueOnce(SENTINEL_DONE);

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
      .mockResolvedValueOnce(SENTINEL_DONE);

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
      .mockResolvedValueOnce(SENTINEL_INHERIT)
      .mockResolvedValueOnce('back')
      .mockResolvedValueOnce(SENTINEL_DONE);

    const result = await promptPackageOverrides(packages, defaults);

    const web = result.find((pkg) => pkg.path === 'apps/web');
    expect(web?.conventions?.fileNaming).toBeUndefined();
  });

  it('sets per-package maxFileLines override', async () => {
    const packages: PackageConfig[] = [
      { name: 'root', path: '.' },
      { name: 'web', path: 'apps/web' },
    ];

    selectMock
      .mockResolvedValueOnce('apps/web')
      .mockResolvedValueOnce('maxFileLines')
      .mockResolvedValueOnce('back')
      .mockResolvedValueOnce(SENTINEL_DONE);
    textMock.mockResolvedValueOnce('500');

    const result = await promptPackageOverrides(packages, defaults);

    const web = result.find((pkg) => pkg.path === 'apps/web');
    expect(web?.rules?.maxFileLines).toBe(500);
  });

  it('exempts package from naming checks via __none__', async () => {
    const packages: PackageConfig[] = [
      { name: 'root', path: '.' },
      { name: 'web', path: 'apps/web' },
    ];

    selectMock
      .mockResolvedValueOnce('apps/web')
      .mockResolvedValueOnce('fileNaming')
      .mockResolvedValueOnce(SENTINEL_NONE)
      .mockResolvedValueOnce('back')
      .mockResolvedValueOnce(SENTINEL_DONE);

    const result = await promptPackageOverrides(packages, defaults);

    const web = result.find((pkg) => pkg.path === 'apps/web');
    expect(web?.conventions?.fileNaming).toBe('');
  });

  it('exits gracefully when user cancels at package select', async () => {
    const packages: PackageConfig[] = [
      { name: 'root', path: '.' },
      { name: 'web', path: 'apps/web' },
    ];

    selectMock.mockResolvedValueOnce('__cancel__');
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit');
    });
    await expect(promptPackageOverrides(packages, defaults)).rejects.toThrow('exit');
    expect(exitSpy).toHaveBeenCalledWith(0);
    exitSpy.mockRestore();
  });

  it('clears maxFileLines when input matches default', async () => {
    const packages: PackageConfig[] = [
      { name: 'root', path: '.' },
      { name: 'web', path: 'apps/web', rules: { maxFileLines: 500 } },
    ];

    selectMock
      .mockResolvedValueOnce('apps/web')
      .mockResolvedValueOnce('maxFileLines')
      .mockResolvedValueOnce('back')
      .mockResolvedValueOnce(SENTINEL_DONE);
    textMock.mockResolvedValueOnce('300');

    const result = await promptPackageOverrides(packages, defaults);

    const web = result.find((pkg) => pkg.path === 'apps/web');
    expect(web?.rules?.maxFileLines).toBeUndefined();
  });
});
