import { describe, expect, it } from 'vitest';
import { spawnAsync } from './spawn-async.js';

describe('spawnAsync', () => {
  it('resolves with exit status 0 for successful commands', async () => {
    const result = await spawnAsync('echo hello', process.cwd());
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('hello');
  });

  it('resolves with non-zero status for failed commands', async () => {
    const result = await spawnAsync('exit 1', process.cwd());
    expect(result.status).toBe(1);
  });

  it('captures stderr output', async () => {
    const result = await spawnAsync('echo err >&2', process.cwd());
    expect(result.stderr.trim()).toBe('err');
  });
});
