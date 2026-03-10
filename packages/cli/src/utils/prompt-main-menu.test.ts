import type { PackageConfig, ScanResult, ViberailsConfig } from '@viberails/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { promptMainMenu } from './prompt-main-menu.js';

const { selectMock, confirmMock, textMock, isCancelMock, noteMock } = vi.hoisted(() => ({
  selectMock: vi.fn(),
  confirmMock: vi.fn(),
  textMock: vi.fn(),
  isCancelMock: vi.fn((value: unknown) => value === '__cancel__'),
  noteMock: vi.fn(),
}));

vi.mock('@clack/prompts', () => ({
  select: selectMock,
  confirm: confirmMock,
  text: textMock,
  note: noteMock,
  cancel: vi.fn(),
  isCancel: isCancelMock,
  spinner: () => ({ start: vi.fn(), stop: vi.fn() }),
  log: { info: vi.fn(), warn: vi.fn() },
}));

vi.mock('./prompt-submenus.js', async (importOriginal) => {
  const orig = await importOriginal<typeof import('./prompt-submenus.js')>();
  return {
    ...orig,
    promptFileLimitsMenu: vi.fn(),
    promptNamingMenu: vi.fn(),
  };
});

vi.mock('./prompt-integrations.js', async (importOriginal) => {
  const orig = await importOriginal<typeof import('./prompt-integrations.js')>();
  return {
    ...orig,
    promptIntegrationsDeferred: vi.fn(() =>
      Promise.resolve({
        choice: {
          preCommitHook: true,
          claudeCodeHook: false,
          claudeMdRef: false,
          githubAction: false,
          typecheckHook: false,
          lintHook: false,
        },
      }),
    ),
  };
});

vi.mock('./prompt-package-overrides.js', async (importOriginal) => {
  const orig = await importOriginal<typeof import('./prompt-package-overrides.js')>();
  return {
    ...orig,
    promptPackageOverrides: vi.fn((pkgs: PackageConfig[]) => Promise.resolve(pkgs)),
  };
});

vi.mock('../display-text.js', () => ({
  formatScanResultsText: vi.fn(() => 'scan details'),
}));

function makeConfig(overrides: Partial<ViberailsConfig> = {}): ViberailsConfig {
  return {
    version: 1,
    name: 'test',
    rules: {
      maxFileLines: 300,
      maxTestFileLines: 0,
      testCoverage: 80,
      enforceNaming: true,
      enforceBoundaries: false,
      enforceMissingTests: true,
    },
    packages: [
      { name: 'root', path: '.', conventions: { fileNaming: 'kebab-case' } } as PackageConfig,
    ],
    ...overrides,
  };
}

function makeScanResult(): ScanResult {
  return {
    root: '/test',
    stack: { language: { name: 'typescript' }, packageManager: { name: 'pnpm' }, libraries: [] },
    structure: { directories: [] },
    conventions: {},
    statistics: {
      totalFiles: 10,
      totalLines: 500,
      averageFileLines: 50,
      largestFiles: [],
      filesByExtension: {},
    },
    packages: [],
  };
}

const defaultOpts = {
  hasTestRunner: true,
  hookManager: undefined as string | undefined,
  coveragePrereqs: [],
  projectRoot: '/test',
  tools: { packageManager: 'pnpm' },
};

describe('promptMainMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns state when user selects done immediately', async () => {
    selectMock.mockResolvedValueOnce('done');
    const config = makeConfig();
    const state = await promptMainMenu(config, makeScanResult(), defaultOpts);
    expect(state.visited.integrations).toBe(false);
    expect(state.deferredInstalls).toEqual([]);
  });

  it('sets enforceNaming to false on done when no fileNaming on root', async () => {
    selectMock.mockResolvedValueOnce('done');
    const config = makeConfig();
    config.packages[0] = { name: 'root', path: '.' } as PackageConfig;
    // enforceNaming is true but no fileNaming set
    await promptMainMenu(config, makeScanResult(), defaultOpts);
    expect(config.rules.enforceNaming).toBe(false);
  });

  it('keeps enforceNaming true on done when fileNaming is set', async () => {
    selectMock.mockResolvedValueOnce('done');
    const config = makeConfig();
    await promptMainMenu(config, makeScanResult(), defaultOpts);
    expect(config.rules.enforceNaming).toBe(true);
  });

  it('handles missingTests toggle', async () => {
    selectMock.mockResolvedValueOnce('missingTests').mockResolvedValueOnce('done');
    confirmMock.mockResolvedValueOnce(false);
    const config = makeConfig();
    await promptMainMenu(config, makeScanResult(), defaultOpts);
    expect(config.rules.enforceMissingTests).toBe(false);
  });

  it('shows info when coverage selected with no test runner', async () => {
    selectMock.mockResolvedValueOnce('coverage').mockResolvedValueOnce('done');
    const config = makeConfig();
    const { log } = await import('@clack/prompts');
    await promptMainMenu(config, makeScanResult(), { ...defaultOpts, hasTestRunner: false });
    expect(log.info).toHaveBeenCalled();
  });

  it('marks integrations as visited', async () => {
    selectMock.mockResolvedValueOnce('integrations').mockResolvedValueOnce('done');
    const config = makeConfig();
    const state = await promptMainMenu(config, makeScanResult(), defaultOpts);
    expect(state.visited.integrations).toBe(true);
    expect(state.integrations).toBeDefined();
  });

  it('reset clears state', async () => {
    selectMock
      .mockResolvedValueOnce('missingTests')
      .mockResolvedValueOnce('reset')
      .mockResolvedValueOnce('done');
    confirmMock.mockResolvedValueOnce(false);
    const config = makeConfig();
    await promptMainMenu(config, makeScanResult(), defaultOpts);
    expect(config.rules.enforceMissingTests).toBe(true);
  });

  it('shows review scan details', async () => {
    selectMock.mockResolvedValueOnce('review').mockResolvedValueOnce('done');
    const config = makeConfig();
    await promptMainMenu(config, makeScanResult(), defaultOpts);
    expect(noteMock).toHaveBeenCalledWith('scan details', 'Scan details');
  });

  it('exits gracefully when user cancels', async () => {
    selectMock.mockResolvedValueOnce('__cancel__');
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit');
    });
    const config = makeConfig();
    await expect(promptMainMenu(config, makeScanResult(), defaultOpts)).rejects.toThrow('exit');
    expect(exitSpy).toHaveBeenCalledWith(0);
    exitSpy.mockRestore();
  });
});
