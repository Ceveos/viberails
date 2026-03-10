import { beforeEach, describe, expect, it, vi } from 'vitest';

const { spinnerMock, writeFileSyncMock } = vi.hoisted(() => ({
  spinnerMock: { start: vi.fn(), stop: vi.fn() },
  writeFileSyncMock: vi.fn(),
}));

vi.mock('@clack/prompts', () => ({
  spinner: () => spinnerMock,
}));

vi.mock('@viberails/scanner', () => ({
  scan: vi.fn().mockResolvedValue({
    root: '/tmp/test',
    stack: { language: { name: 'typescript' }, packageManager: { name: 'pnpm' }, libraries: [] },
    structure: { directories: [] },
    conventions: {},
    statistics: {
      totalFiles: 10,
      totalLines: 1000,
      averageFileLines: 100,
      largestFiles: [],
      filesByExtension: {},
    },
    packages: [],
  }),
}));

vi.mock('@viberails/config', () => ({
  generateConfig: vi.fn().mockReturnValue({
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
    packages: [{ name: 'root', path: '.', conventions: { fileNaming: 'kebab-case' } }],
  }),
  compactConfig: vi.fn((c: unknown) => c),
}));

vi.mock('node:fs', () => ({
  writeFileSync: writeFileSyncMock,
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn().mockReturnValue(''),
  mkdirSync: vi.fn(),
}));

vi.mock('../display.js', () => ({
  displayRulesPreview: vi.fn(),
  displayScanResults: vi.fn(),
}));

vi.mock('../utils/check-prerequisites.js', () => ({
  checkCoveragePrereqs: vi.fn().mockReturnValue([]),
  displayMissingPrereqs: vi.fn(),
}));

vi.mock('../utils/filter-confidence.js', () => ({
  filterHighConfidence: vi.fn((conventions: unknown) => conventions),
}));

vi.mock('../utils/resolve-workspace-packages.js', () => ({
  resolveWorkspacePackages: vi.fn().mockReturnValue([]),
}));

vi.mock('../utils/update-gitignore.js', () => ({
  updateGitignore: vi.fn(),
}));

vi.mock('../utils/write-generated-files.js', () => ({
  writeGeneratedFiles: vi.fn(),
}));

vi.mock('./init-hooks.js', () => ({
  detectHookManager: vi.fn().mockReturnValue(null),
  setupClaudeCodeHook: vi.fn(),
  setupClaudeMdReference: vi.fn(),
  setupGithubAction: vi.fn(),
  setupPreCommitHook: vi.fn(),
}));

vi.mock('./init-hooks-extra.js', () => ({
  setupLintHook: vi.fn(),
  setupTypecheckHook: vi.fn(),
}));

import { initNonInteractive } from './init-non-interactive.js';

describe('initNonInteractive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scans, generates config, and writes config file', async () => {
    await initNonInteractive('/tmp/test', '/tmp/test/viberails.config.json');
    expect(spinnerMock.start).toHaveBeenCalledWith('Scanning project...');
    expect(spinnerMock.stop).toHaveBeenCalledWith('Scan complete');
    expect(writeFileSyncMock).toHaveBeenCalledWith(
      '/tmp/test/viberails.config.json',
      expect.stringContaining('"version"'),
    );
  });

  it('filters conventions to high confidence only', async () => {
    const { filterHighConfidence } = await import('../utils/filter-confidence.js');
    await initNonInteractive('/tmp/test', '/tmp/test/viberails.config.json');
    expect(filterHighConfidence).toHaveBeenCalled();
  });

  it('sets up claude code hook and claude.md reference', async () => {
    const { setupClaudeCodeHook, setupClaudeMdReference } = await import('./init-hooks.js');
    await initNonInteractive('/tmp/test', '/tmp/test/viberails.config.json');
    expect(setupClaudeCodeHook).toHaveBeenCalledWith('/tmp/test');
    expect(setupClaudeMdReference).toHaveBeenCalledWith('/tmp/test');
  });
});
