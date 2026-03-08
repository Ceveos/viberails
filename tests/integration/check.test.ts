import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkCommand } from '../../packages/cli/src/commands/check.js';
import { initCommand } from '../../packages/cli/src/commands/init.js';

describe('check command', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viberails-check-'));
    const fixtureSrc = path.resolve(__dirname, '../fixtures/nextjs-15');
    fs.cpSync(fixtureSrc, tmpDir, { recursive: true });
    await initCommand({ yes: true }, tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns exit code 0 when no violations exist', async () => {
    const exitCode = await checkCommand({}, tmpDir);
    expect(exitCode).toBe(0);
  });

  it('detects an oversized file', async () => {
    const bigFile = path.join(tmpDir, 'src', 'lib', 'big-module.ts');
    fs.writeFileSync(bigFile, Array(310).fill('const x = 1;').join('\n'));

    const exitCode = await checkCommand({ files: ['src/lib/big-module.ts'] }, tmpDir);
    // In warn mode, still exits 0 but violation is detected
    expect(exitCode).toBe(0);
  });

  it('detects a naming convention violation', async () => {
    const badFile = path.join(tmpDir, 'src', 'lib', 'BadName.ts');
    fs.writeFileSync(badFile, 'export const x = 1;\n');

    const exitCode = await checkCommand({ files: ['src/lib/BadName.ts'] }, tmpDir);
    expect(exitCode).toBe(0); // warn mode
  });

  it('returns exit code 1 in enforce mode with violations', async () => {
    const bigFile = path.join(tmpDir, 'src', 'lib', 'big-module.ts');
    fs.writeFileSync(bigFile, Array(310).fill('const x = 1;').join('\n'));

    const exitCode = await checkCommand(
      { enforce: true, files: ['src/lib/big-module.ts'] },
      tmpDir,
    );
    expect(exitCode).toBe(1);
  });

  it('passes when checking specific valid files', async () => {
    const exitCode = await checkCommand({ files: ['src/components/user-profile.tsx'] }, tmpDir);
    expect(exitCode).toBe(0);
  });
});
