import { spawn } from 'node:child_process';

export interface SpawnResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

/**
 * Run a shell command asynchronously so the event loop stays responsive
 * (e.g. for CLI spinner animations). Drop-in replacement for spawnSync.
 */
export function spawnAsync(command: string, cwd: string): Promise<SpawnResult> {
  return new Promise((resolve) => {
    const child = spawn(command, { cwd, shell: true, stdio: 'pipe' });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString();
    });
    child.on('close', (status) => {
      resolve({ status, stdout, stderr });
    });
    child.on('error', () => {
      resolve({ status: 1, stdout, stderr });
    });
  });
}
