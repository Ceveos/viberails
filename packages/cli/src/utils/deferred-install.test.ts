import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import type { DeferredInstall } from './deferred-install.js';
import { executeDeferredInstalls } from './deferred-install.js';

vi.mock('@clack/prompts', () => ({
  spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
  log: { warn: vi.fn() },
}));

vi.mock('./spawn-async.js', () => ({
  spawnAsync: vi.fn(),
}));

let spawnAsyncMock: Mock;

beforeEach(async () => {
  vi.clearAllMocks();
  const mod = await import('./spawn-async.js');
  spawnAsyncMock = mod.spawnAsync as Mock;
});

describe('executeDeferredInstalls', () => {
  it('returns 0 for empty list', async () => {
    const result = await executeDeferredInstalls('/project', []);
    expect(result).toBe(0);
    expect(spawnAsyncMock).not.toHaveBeenCalled();
  });

  it('calls spawnAsync for each install and returns success count', async () => {
    spawnAsyncMock.mockResolvedValue({ status: 0, stdout: '', stderr: '' });

    const installs: DeferredInstall[] = [
      { label: 'pkg-a', command: 'npm install pkg-a' },
      { label: 'pkg-b', command: 'npm install pkg-b' },
    ];

    const result = await executeDeferredInstalls('/project', installs);
    expect(result).toBe(2);
    expect(spawnAsyncMock).toHaveBeenCalledTimes(2);
    expect(spawnAsyncMock).toHaveBeenCalledWith('npm install pkg-a', '/project');
    expect(spawnAsyncMock).toHaveBeenCalledWith('npm install pkg-b', '/project');
  });

  it('calls onFailure when install fails', async () => {
    spawnAsyncMock.mockResolvedValue({ status: 1, stdout: '', stderr: 'error' });
    const onFailure = vi.fn();

    const installs: DeferredInstall[] = [
      { label: 'pkg-a', command: 'npm install pkg-a', onFailure },
    ];

    const result = await executeDeferredInstalls('/project', installs);
    expect(result).toBe(0);
    expect(onFailure).toHaveBeenCalledOnce();
  });

  it('continues after a failed install', async () => {
    spawnAsyncMock
      .mockResolvedValueOnce({ status: 1, stdout: '', stderr: 'error' })
      .mockResolvedValueOnce({ status: 0, stdout: '', stderr: '' });

    const installs: DeferredInstall[] = [
      { label: 'pkg-a', command: 'npm install pkg-a' },
      { label: 'pkg-b', command: 'npm install pkg-b' },
    ];

    const result = await executeDeferredInstalls('/project', installs);
    expect(result).toBe(1);
    expect(spawnAsyncMock).toHaveBeenCalledTimes(2);
  });
});
