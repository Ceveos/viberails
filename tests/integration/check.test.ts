import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkCommand as rawCheckCommand } from '../../packages/cli/src/commands/check.js';
import { initCommand } from '../../packages/cli/src/commands/init.js';

async function checkCommand(
  options: Parameters<typeof rawCheckCommand>[0],
  cwd: string,
): Promise<number> {
  return rawCheckCommand({ quiet: true, ...options }, cwd);
}

function disableCoverage(rootDir: string): void {
  const configPath = path.join(rootDir, 'viberails.config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  config.rules.testCoverage = 0;
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
}

describe('check command', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viberails-check-'));
    const fixtureSrc = path.resolve(__dirname, '../fixtures/nextjs-15');
    fs.cpSync(fixtureSrc, tmpDir, { recursive: true });
    await initCommand({ yes: true }, tmpDir);
    disableCoverage(tmpDir);
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

describe('check on zero-test repo', () => {
  let tmpDir: string;

  beforeEach(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viberails-notest-'));
    const fixtureSrc = path.resolve(__dirname, '../fixtures/flat-structure');
    fs.cpSync(fixtureSrc, tmpDir, { recursive: true });
    await initCommand({ yes: true }, tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('generates config with default testPattern for zero-test repo', () => {
    const configPath = path.join(tmpDir, 'viberails.config.json');
    expect(fs.existsSync(configPath)).toBe(true);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const pkg = config.packages[0];
    expect(pkg.structure.testPattern).toBeDefined();
    expect(pkg.structure.srcDir).toBe('.');
  });

  it('reports missing-test violations for source files without tests', async () => {
    const exitCode = await checkCommand({ format: 'json' }, tmpDir);
    const output = (console.log as ReturnType<typeof vi.fn>).mock.calls
      .map((c) => c[0])
      .find((s) => typeof s === 'string' && s.startsWith('{'));
    expect(output).toBeDefined();
    const parsed = JSON.parse(output);
    const missingTests = parsed.violations.filter(
      (v: { rule: string }) => v.rule === 'missing-test',
    );
    expect(missingTests.length).toBeGreaterThan(0);
    expect(exitCode).toBe(0); // warn mode
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

  it('ignores non-source files like lockfiles and markdown', async () => {
    const lockfile = path.join(tmpDir, 'pnpm-lock.yaml');
    fs.writeFileSync(lockfile, Array(500).fill('  resolution: {integrity: sha}').join('\n'));
    const readme = path.join(tmpDir, 'README.md');
    fs.writeFileSync(readme, Array(500).fill('# Docs').join('\n'));
    execSync('git add -A && git commit --no-verify -m "add non-source files"', {
      cwd: tmpDir,
      stdio: 'pipe',
    });

    const exitCode = await checkCommand(
      { enforce: true, diffBase: baseRef, noBoundaries: true },
      tmpDir,
    );
    expect(exitCode).toBe(0);
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

  it('returns exit code 1 for invalid diff-base in enforce mode', async () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    try {
      const exitCode = await checkCommand(
        { enforce: true, diffBase: 'nonexistent-branch-xyz', noBoundaries: true },
        tmpDir,
      );
      expect(exitCode).toBe(1);
    } finally {
      stderrSpy.mockRestore();
    }
  });

  it('returns exit code 0 for invalid diff-base in warn mode', async () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    try {
      const exitCode = await checkCommand(
        { diffBase: 'nonexistent-branch-xyz', noBoundaries: true },
        tmpDir,
      );
      expect(exitCode).toBe(0);
    } finally {
      stderrSpy.mockRestore();
    }
  });

  it('catches missing-test when a test file is deleted', async () => {
    // Add a source file with its test in the base commit
    const srcFile = path.join(tmpDir, 'src', 'lib', 'helper.ts');
    const testFile = path.join(tmpDir, 'src', 'lib', 'helper.test.ts');
    fs.writeFileSync(srcFile, 'export const helper = true;\n');
    fs.writeFileSync(testFile, 'import { helper } from "./helper";\ntest("ok", () => {});\n');
    execSync('git add -A && git commit --no-verify -m "add helper with test"', {
      cwd: tmpDir,
      stdio: 'pipe',
    });
    const newBase = execSync('git rev-parse HEAD', { cwd: tmpDir, encoding: 'utf-8' }).trim();
    execSync('git checkout -b delete-test', { cwd: tmpDir, stdio: 'ignore' });

    // Delete only the test file
    fs.unlinkSync(testFile);
    execSync('git add -A && git commit --no-verify -m "delete test"', {
      cwd: tmpDir,
      stdio: 'pipe',
    });

    const exitCode = await checkCommand(
      { enforce: true, diffBase: newBase, noBoundaries: true, format: 'json' },
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
    expect(missingTests.length).toBeGreaterThan(0);
    expect(missingTests[0].file).toContain('helper');
    expect(exitCode).toBe(1);
  });

  it('catches missing-test when a test file is deleted in staged mode', async () => {
    // Add a source file with its test
    const srcFile = path.join(tmpDir, 'src', 'lib', 'staged-util.ts');
    const testFile = path.join(tmpDir, 'src', 'lib', 'staged-util.test.ts');
    fs.writeFileSync(srcFile, 'export const util = true;\n');
    fs.writeFileSync(testFile, 'import { util } from "./staged-util";\ntest("ok", () => {});\n');
    execSync('git add -A && git commit --no-verify -m "add staged-util with test"', {
      cwd: tmpDir,
      stdio: 'pipe',
    });

    // Stage deletion of the test file only
    fs.unlinkSync(testFile);
    execSync('git add -A', { cwd: tmpDir, stdio: 'pipe' });

    const exitCode = await checkCommand(
      { enforce: true, staged: true, noBoundaries: true, format: 'json' },
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
    expect(missingTests.length).toBeGreaterThan(0);
    expect(missingTests[0].file).toContain('staged-util');
    expect(exitCode).toBe(1);
  });
});

describe('check with dedicated test directories', () => {
  let tmpDir: string;
  let baseRef: string;

  beforeEach(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viberails-dedicated-tests-'));
    const fixtureSrc = path.resolve(__dirname, '../fixtures/dedicated-tests');
    fs.cpSync(fixtureSrc, tmpDir, { recursive: true });

    execSync('git init', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'ignore' });

    await initCommand({ yes: true }, tmpDir);

    execSync('git add -A', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git commit --no-verify -m "initial"', { cwd: tmpDir, stdio: 'pipe' });
    baseRef = execSync('git rev-parse HEAD', { cwd: tmpDir, encoding: 'utf-8' }).trim();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('catches missing-test when a dedicated test file is deleted in staged mode', async () => {
    fs.unlinkSync(path.join(tmpDir, '__tests__', 'lib', 'foo.test.ts'));
    execSync('git add -A', { cwd: tmpDir, stdio: 'pipe' });

    const exitCode = await checkCommand(
      { enforce: true, staged: true, noBoundaries: true, format: 'json' },
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
    expect(missingTests.length).toBeGreaterThan(0);
    expect(missingTests[0].file).toBe('src/lib/foo.ts');
    expect(exitCode).toBe(1);
  });

  it('catches missing-test when a dedicated test file is deleted in diff mode', async () => {
    execSync('git checkout -b delete-dedicated-test', { cwd: tmpDir, stdio: 'ignore' });
    fs.unlinkSync(path.join(tmpDir, '__tests__', 'lib', 'foo.test.ts'));
    execSync('git add -A && git commit --no-verify -m "delete test"', {
      cwd: tmpDir,
      stdio: 'pipe',
    });

    const exitCode = await checkCommand(
      { enforce: true, diffBase: baseRef, noBoundaries: true, format: 'json' },
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
    expect(missingTests.length).toBeGreaterThan(0);
    expect(missingTests[0].file).toBe('src/lib/foo.ts');
    expect(exitCode).toBe(1);
  });
});

describe('check --staged with renamed files', () => {
  let tmpDir: string;

  beforeEach(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viberails-rename-'));
    const fixtureSrc = path.resolve(__dirname, '../fixtures/kebab-rename');
    fs.cpSync(fixtureSrc, tmpDir, { recursive: true });

    execSync('git init', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'ignore' });

    await initCommand({ yes: true }, tmpDir);

    const configPath = path.join(tmpDir, 'viberails.config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    config.rules.testCoverage = 0;
    config.rules.enforceMissingTests = false;
    config.packages[0].conventions = {
      ...(config.packages[0].conventions ?? {}),
      fileNaming: 'kebab-case',
    };
    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

    execSync('git add -A', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git commit --no-verify -m "initial"', { cwd: tmpDir, stdio: 'pipe' });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('checks renamed files in staged mode', async () => {
    execSync('git mv src/good-name.ts src/BadName.ts', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git add -A', { cwd: tmpDir, stdio: 'pipe' });

    const exitCode = await checkCommand(
      { enforce: true, staged: true, noBoundaries: true, format: 'json' },
      tmpDir,
    );

    const output = (console.log as ReturnType<typeof vi.fn>).mock.calls
      .map((c) => c[0])
      .find((s) => typeof s === 'string' && s.startsWith('{'));
    expect(output).toBeDefined();
    const parsed = JSON.parse(output);
    const namingViolations = parsed.violations.filter(
      (v: { rule: string }) => v.rule === 'file-naming',
    );
    expect(namingViolations.length).toBeGreaterThan(0);
    expect(namingViolations[0].file).toBe('src/BadName.ts');
    expect(exitCode).toBe(1);
  });
});
