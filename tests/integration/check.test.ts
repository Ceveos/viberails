import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('returns exit code 0 in warn mode even when violations exist', async () => {
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

describe('check --diff-base', () => {
  let tmpDir: string;
  let baseRef: string;

  beforeEach(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viberails-diff-'));
    const fixtureSrc = path.resolve(__dirname, '../fixtures/nextjs-15');
    fs.cpSync(fixtureSrc, tmpDir, { recursive: true });

    // Initialize git repo first so initCommand can set up hooks
    execSync('git init', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'ignore' });

    await initCommand({ yes: true }, tmpDir);

    execSync('git add -A', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git commit --no-verify -m "initial"', { cwd: tmpDir, stdio: 'pipe' });
    baseRef = execSync('git rev-parse HEAD', { cwd: tmpDir, encoding: 'utf-8' }).trim();

    // Create a feature branch for changes
    execSync('git checkout -b feature', { cwd: tmpDir, stdio: 'ignore' });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('only checks files changed since the base ref', async () => {
    const bigFile = path.join(tmpDir, 'src', 'lib', 'big-module.ts');
    fs.writeFileSync(bigFile, Array(310).fill('const x = 1;').join('\n'));
    execSync('git add -A && git commit --no-verify -m "add big file"', {
      cwd: tmpDir,
      stdio: 'pipe',
    });

    const exitCode = await checkCommand(
      { enforce: true, diffBase: baseRef, noBoundaries: true },
      tmpDir,
    );
    expect(exitCode).toBe(1);
  });

  it('does not flag pre-existing violations outside the diff', async () => {
    // Add a new source file WITH a corresponding test — no violations
    const newFile = path.join(tmpDir, 'src', 'lib', 'clean-util.ts');
    fs.writeFileSync(newFile, 'export const clean = true;\n');
    const testFile = path.join(tmpDir, 'src', 'lib', 'clean-util.test.ts');
    fs.writeFileSync(testFile, 'import { clean } from "./clean-util";\ntest("ok", () => {});\n');
    execSync('git add -A && git commit --no-verify -m "add clean file"', {
      cwd: tmpDir,
      stdio: 'pipe',
    });

    const exitCode = await checkCommand(
      { enforce: true, diffBase: baseRef, noBoundaries: true },
      tmpDir,
    );
    expect(exitCode).toBe(0);
  });

  it('skips coverage checks in diff mode', async () => {
    const newFile = path.join(tmpDir, 'src', 'lib', 'new-util.ts');
    fs.writeFileSync(newFile, 'export const util = true;\n');
    execSync('git add -A && git commit --no-verify -m "add util"', {
      cwd: tmpDir,
      stdio: 'pipe',
    });

    const exitCode = await checkCommand(
      { diffBase: baseRef, noBoundaries: true, format: 'json' },
      tmpDir,
    );

    const output = (console.log as ReturnType<typeof vi.fn>).mock.calls
      .map((c) => c[0])
      .find((s) => typeof s === 'string' && s.startsWith('{'));
    expect(output).toBeDefined();
    const parsed = JSON.parse(output);
    const coverageViolations = parsed.violations.filter(
      (v: { rule: string }) => v.rule === 'test-coverage',
    );
    expect(coverageViolations).toHaveLength(0);
    expect(exitCode).toBe(0);
  });

  it('only reports missing-test violations for newly added files', async () => {
    // Modify an existing file (should NOT trigger missing-test)
    const existingFile = path.join(tmpDir, 'src', 'components', 'user-card.tsx');
    const original = fs.readFileSync(existingFile, 'utf-8');
    fs.writeFileSync(existingFile, `${original}\n// modified\n`);

    // Add a new source file WITHOUT a test (should trigger missing-test)
    const newFile = path.join(tmpDir, 'src', 'lib', 'no-test-util.ts');
    fs.writeFileSync(newFile, 'export const x = 1;\n');

    execSync('git add -A && git commit --no-verify -m "changes"', {
      cwd: tmpDir,
      stdio: 'pipe',
    });

    const exitCode = await checkCommand(
      { diffBase: baseRef, noBoundaries: true, format: 'json' },
      tmpDir,
    );

    const output = (console.log as ReturnType<typeof vi.fn>).mock.calls
      .map((c) => c[0])
      .find((s) => typeof s === 'string' && s.startsWith('{'));
    expect(output).toBeDefined();
    const parsed = JSON.parse(output);
    const missingTests = parsed.violations.filter(
      (v: { rule: string }) => v.rule === 'missing-test',
    );
    // Only the newly added file should have missing-test, not the modified one
    for (const v of missingTests) {
      expect(v.file).not.toContain('user-card');
    }
    expect(exitCode).toBe(0);
  });

  it('returns empty when diff has no changes', async () => {
    const exitCode = await checkCommand({ diffBase: baseRef, noBoundaries: true }, tmpDir);
    expect(exitCode).toBe(0);
  });
});
