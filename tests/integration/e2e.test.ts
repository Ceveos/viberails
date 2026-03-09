import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkCommand as rawCheckCommand } from '../../packages/cli/src/commands/check.js';
import { initCommand } from '../../packages/cli/src/commands/init.js';
import { syncCommand } from '../../packages/cli/src/commands/sync.js';
import type { ViberailsConfig } from '../../packages/types/src/index.js';

let tmpDir: string;

async function checkCommand(
  options: Parameters<typeof rawCheckCommand>[0],
  cwd: string,
): Promise<number> {
  return rawCheckCommand({ quiet: true, ...options }, cwd);
}

function readConfig(): ViberailsConfig {
  return JSON.parse(fs.readFileSync(path.join(tmpDir, 'viberails.config.json'), 'utf-8'));
}

function disableCoverage(): void {
  const configPath = path.join(tmpDir, 'viberails.config.json');
  const config = readConfig();
  config.rules.testCoverage = 0;
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
}

describe('end-to-end: init + sync + check on realistic Next.js 15 project', () => {
  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viberails-e2e-'));
    const fixtureSrc = path.resolve(__dirname, '../fixtures/nextjs-15');
    fs.cpSync(fixtureSrc, tmpDir, { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('runs init in --yes mode without throwing', async () => {
    await initCommand({ yes: true }, tmpDir);
  });

  it('creates viberails.config.json with correct stack detection', () => {
    const config = readConfig();
    expect(config.version).toBe(1);
    expect(config.packages).toBeDefined();
    expect(config.packages.length).toBeGreaterThan(0);
    const root = config.packages.find((p) => p.path === '.') ?? config.packages[0];
    expect(root.stack?.framework).toBe('nextjs@15');
    expect(root.stack?.language).toMatch(/^typescript/);
    expect(root.stack?.styling).toMatch(/^tailwindcss/);
    expect(root.stack?.linter).toMatch(/^eslint/);
    expect(root.stack?.testRunner).toMatch(/^vitest/);
    expect(root.stack?.packageManager).toBe('npm');
  });

  it('detects correct directory structure', () => {
    const config = readConfig();
    const root = config.packages.find((p) => p.path === '.') ?? config.packages[0];
    expect(root.structure?.srcDir).toBe('src');
    expect(root.structure?.pages).toBe('src/app');
    expect(root.structure?.components).toBe('src/components');
    expect(root.structure?.hooks).toBe('src/hooks');
    expect(root.structure?.utils).toBe('src/lib');
    expect(root.structure?.tests).toBe('__tests__');
    expect(root.structure?.testPattern).toBe('*.test.ts');
  });

  it('detects kebab-case naming at high confidence', () => {
    const config = readConfig();
    const root = config.packages.find((p) => p.path === '.') ?? config.packages[0];
    expect(root.conventions?.fileNaming).toBe('kebab-case');
  });

  it('detects import alias from tsconfig paths', () => {
    const config = readConfig();
    const root = config.packages.find((p) => p.path === '.') ?? config.packages[0];
    expect(root.conventions?.importAlias).toBe('@/*');
  });

  it('has default rules', () => {
    const config = readConfig();
    expect(config.rules.maxFileLines).toBe(300);
    expect(config.rules.testCoverage).toBe(80);
    expect(config.rules.enforceNaming).toBe(true);
    expect(config.rules.enforceBoundaries).toBe(false);
  });

  it('generates .viberails/context.md with enforced rules', () => {
    const contextPath = path.join(tmpDir, '.viberails', 'context.md');
    expect(fs.existsSync(contextPath)).toBe(true);
    const content = fs.readFileSync(contextPath, 'utf-8');

    expect(content).toContain('viberails enforced rules');
    expect(content).toContain('300 lines');
    expect(content).toContain('kebab-case');
  });

  it('creates CLAUDE.md with context reference', () => {
    const claudeMd = fs.readFileSync(path.join(tmpDir, 'CLAUDE.md'), 'utf-8');
    expect(claudeMd).toContain('@.viberails/context.md');
    expect(fs.existsSync(path.join(tmpDir, '.cursorrules'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, '.claude', 'settings.json'))).toBe(true);
  });

  it('updates .gitignore with scan-result.json only', () => {
    const gitignorePath = path.join(tmpDir, '.gitignore');
    expect(fs.existsSync(gitignorePath)).toBe(true);
    const content = fs.readFileSync(gitignorePath, 'utf-8');
    expect(content).toContain('.viberails/scan-result.json');
    expect(content).not.toContain('.cursorrules');
  });

  it('check returns 0 in warn mode on the fixture project (with violations)', async () => {
    disableCoverage();
    const exitCode = await checkCommand({}, tmpDir);
    expect(exitCode).toBe(0);
  });

  it('syncs after adding a new component file', async () => {
    const configBefore = readConfig();

    // Add a new component
    fs.writeFileSync(
      path.join(tmpDir, 'src', 'components', 'modal-dialog.tsx'),
      `${[
        'import React from "react";',
        '',
        'interface ModalDialogProps {',
        '  open: boolean;',
        '  onClose: () => void;',
        '  children: React.ReactNode;',
        '}',
        '',
        'export function ModalDialog({ open, onClose, children }: ModalDialogProps) {',
        '  if (!open) return null;',
        '',
        '  return (',
        '    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">',
        '      <div className="rounded-lg bg-white p-6 shadow-xl">',
        '        <button onClick={onClose} className="absolute right-2 top-2">',
        '          &times;',
        '        </button>',
        '        {children}',
        '      </div>',
        '    </div>',
        '  );',
        '}',
      ].join('\n')}\n`,
    );

    await syncCommand({}, tmpDir);

    // Context regenerated with rules format
    const contextAfter = fs.readFileSync(path.join(tmpDir, '.viberails', 'context.md'), 'utf-8');
    expect(contextAfter).toContain('viberails enforced rules');

    // Config rules preserved across sync
    const configAfter = readConfig();
    expect(configAfter.version).toBe(configBefore.version);
    const rootBefore =
      configBefore.packages.find((p) => p.path === '.') ?? configBefore.packages[0];
    const rootAfter = configAfter.packages.find((p) => p.path === '.') ?? configAfter.packages[0];
    expect(rootAfter.stack?.framework).toBe(rootBefore.stack?.framework);
    expect(configAfter.rules.maxFileLines).toBe(configBefore.rules.maxFileLines);
  });
});
