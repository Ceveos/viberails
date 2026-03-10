import type { PackageConfig, ScanResult, ViberailsConfig } from '@viberails/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  handleBoundaries,
  handleCoverage,
  handleFileNaming,
  handleMissingTests,
} from './prompt-main-menu-handlers.js';
import type { InitMenuState, MainMenuOpts } from './prompt-main-menu-types.js';

const { selectMock, confirmMock, textMock, noteMock, isCancelMock } = vi.hoisted(() => ({
  selectMock: vi.fn(),
  confirmMock: vi.fn(),
  textMock: vi.fn(),
  noteMock: vi.fn(),
  isCancelMock: vi.fn((value: unknown) => value === '__cancel__'),
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
  return { ...orig, promptNamingMenu: vi.fn() };
});

vi.mock('./prompt-package-overrides.js', async (importOriginal) => {
  const orig = await importOriginal<typeof import('./prompt-package-overrides.js')>();
  return {
    ...orig,
    promptPackageOverrides: vi.fn((pkgs: PackageConfig[]) => Promise.resolve(pkgs)),
  };
});

vi.mock('@viberails/graph', () => ({
  buildImportGraph: vi.fn(() => ({})),
  inferBoundaries: vi.fn(() => ({ deny: { '@pkg/a': ['@pkg/b'] } })),
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

function makeState(overrides: Partial<InitMenuState> = {}): InitMenuState {
  return {
    visited: { integrations: false, boundaries: false },
    deferredInstalls: [],
    hasTestRunner: true,
    hookManager: undefined,
    ...overrides,
  };
}

const defaultOpts: MainMenuOpts = {
  hasTestRunner: true,
  hookManager: undefined,
  coveragePrereqs: [],
  projectRoot: '/test',
  tools: { packageManager: 'pnpm' },
};

describe('handleFileNaming', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns without changes when user cancels', async () => {
    selectMock.mockResolvedValueOnce('__cancel__');
    const config = makeConfig();
    await handleFileNaming(config, makeScanResult());
    expect(config.rules.enforceNaming).toBe(true);
    expect(config.packages[0].conventions?.fileNaming).toBe('kebab-case');
  });

  it('disables enforce when user picks skip', async () => {
    selectMock.mockResolvedValueOnce('__skip__');
    const config = makeConfig();
    await handleFileNaming(config, makeScanResult());
    expect(config.rules.enforceNaming).toBe(false);
  });

  it('sets naming convention on root package', async () => {
    selectMock.mockResolvedValueOnce('PascalCase');
    const config = makeConfig();
    await handleFileNaming(config, makeScanResult());
    expect(config.packages[0].conventions?.fileNaming).toBe('PascalCase');
    expect(config.rules.enforceNaming).toBe(true);
  });
});

describe('handleMissingTests', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns without changes when user cancels', async () => {
    confirmMock.mockResolvedValueOnce('__cancel__');
    const config = makeConfig();
    await handleMissingTests(config);
    expect(config.rules.enforceMissingTests).toBe(true);
  });

  it('toggles enforceMissingTests', async () => {
    confirmMock.mockResolvedValueOnce(false);
    const config = makeConfig();
    await handleMissingTests(config);
    expect(config.rules.enforceMissingTests).toBe(false);
  });
});

describe('handleCoverage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows note and returns when no test runner', async () => {
    const config = makeConfig();
    const state = makeState();
    await handleCoverage(config, state, { ...defaultOpts, hasTestRunner: false });
    expect(noteMock).toHaveBeenCalledWith(
      expect.stringContaining('No test runner'),
      'Coverage inactive',
    );
    expect(config.rules.testCoverage).toBe(80);
  });

  it('returns without changes when user cancels coverage target', async () => {
    textMock.mockResolvedValueOnce('__cancel__');
    const config = makeConfig();
    const state = makeState();
    await handleCoverage(config, state, defaultOpts);
    expect(config.rules.testCoverage).toBe(80);
  });

  it('returns without changes when user cancels prereq choice', async () => {
    const prereqs = [{ label: 'p', reason: 'needed', installed: false, installCommand: 'cmd' }];
    selectMock.mockResolvedValueOnce('__cancel__');
    const config = makeConfig();
    const state = makeState();
    await handleCoverage(config, state, { ...defaultOpts, coveragePrereqs: prereqs });
    expect(config.rules.testCoverage).toBe(80);
  });

  it('updates coverage target', async () => {
    textMock.mockResolvedValueOnce('60');
    const config = makeConfig();
    const state = makeState();
    await handleCoverage(config, state, defaultOpts);
    expect(config.rules.testCoverage).toBe(60);
  });
});

describe('handleBoundaries', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns without changes when user cancels', async () => {
    confirmMock.mockResolvedValueOnce('__cancel__');
    const config = makeConfig({
      packages: [
        { name: 'root', path: '.', conventions: { fileNaming: 'kebab-case' } } as PackageConfig,
        { name: 'pkg', path: 'packages/pkg' } as PackageConfig,
      ],
    });
    const state = makeState();
    await handleBoundaries(config, state, defaultOpts);
    expect(state.visited.boundaries).toBe(false);
    expect(config.rules.enforceBoundaries).toBe(false);
  });

  it('sets enforceBoundaries false when user declines', async () => {
    confirmMock.mockResolvedValueOnce(false);
    const config = makeConfig({
      packages: [
        { name: 'root', path: '.', conventions: { fileNaming: 'kebab-case' } } as PackageConfig,
        { name: 'pkg', path: 'packages/pkg' } as PackageConfig,
      ],
    });
    const state = makeState();
    await handleBoundaries(config, state, defaultOpts);
    expect(state.visited.boundaries).toBe(true);
    expect(config.rules.enforceBoundaries).toBe(false);
  });
});
