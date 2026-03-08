import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkCommand } from '../../packages/cli/src/commands/check.js';
import { initCommand } from '../../packages/cli/src/commands/init.js';
import { syncCommand } from '../../packages/cli/src/commands/sync.js';
import type { ViberailsConfig } from '../../packages/types/src/index.js';

let tmpDir: string;

function readConfig(): ViberailsConfig {
  return JSON.parse(fs.readFileSync(path.join(tmpDir, 'viberails.config.json'), 'utf-8'));
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
    expect(config.stack.framework).toBe('nextjs@15');
    expect(config.stack.language).toMatch(/^typescript/);
    expect(config.stack.styling).toMatch(/^tailwindcss/);
    expect(config.stack.linter).toMatch(/^eslint/);
    expect(config.stack.testRunner).toMatch(/^vitest/);
    expect(config.stack.packageManager).toBe('npm');
  });

  it('detects correct directory structure', () => {
    const config = readConfig();
    expect(config.structure.srcDir).toBe('src');
    expect(config.structure.pages).toBe('src/app');
    expect(config.structure.components).toBe('src/components');
    expect(config.structure.hooks).toBe('src/hooks');
    expect(config.structure.utils).toBe('src/lib');
    expect(config.structure.tests).toBe('__tests__');
    expect(config.structure.testPattern).toBe('*.test.ts');
  });

  it('detects kebab-case naming at high confidence', () => {
    const config = readConfig();
    expect(config.conventions.fileNaming).toBeDefined();
    const fileNaming = config.conventions.fileNaming as { value: string; _confidence: string };
    expect(fileNaming.value).toBe('kebab-case');
    expect(fileNaming._confidence).toBe('high');
  });

  it('detects import alias from tsconfig paths', () => {
    const config = readConfig();
    expect(config.conventions.importAlias).toBeDefined();
    const alias = config.conventions.importAlias;
    const value = typeof alias === 'string' ? alias : (alias as { value: string }).value;
    expect(value).toBe('@/*');
  });

  it('has default rules', () => {
    const config = readConfig();
    expect(config.rules.maxFileLines).toBe(300);
    expect(config.rules.maxFunctionLines).toBe(50);
    expect(config.rules.requireTests).toBe(true);
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
  });

  it('updates .gitignore with scan-result.json only', () => {
    const gitignorePath = path.join(tmpDir, '.gitignore');
    expect(fs.existsSync(gitignorePath)).toBe(true);
    const content = fs.readFileSync(gitignorePath, 'utf-8');
    expect(content).toContain('.viberails/scan-result.json');
    expect(content).not.toContain('.cursorrules');
  });

  it('check passes on the fixture project', async () => {
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

    await syncCommand(tmpDir);

    // Context regenerated with rules format
    const contextAfter = fs.readFileSync(path.join(tmpDir, '.viberails', 'context.md'), 'utf-8');
    expect(contextAfter).toContain('viberails enforced rules');

    // Config rules preserved across sync
    const configAfter = readConfig();
    expect(configAfter.version).toBe(configBefore.version);
    expect(configAfter.stack.framework).toBe(configBefore.stack.framework);
    expect(configAfter.rules.maxFileLines).toBe(configBefore.rules.maxFileLines);
    expect(configAfter.rules.maxFunctionLines).toBe(configBefore.rules.maxFunctionLines);
  });
});
