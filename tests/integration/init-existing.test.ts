import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initCommand } from '../../packages/cli/src/commands/init.js';

describe('init command with existing CLAUDE.md', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viberails-init-existing-'));
    const fixtureSrc = path.resolve(__dirname, '../fixtures/nextjs-15');
    fs.cpSync(fixtureSrc, tmpDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('preserves existing CLAUDE.md content and appends import directive', async () => {
    const claudeMdPath = path.join(tmpDir, 'CLAUDE.md');
    const customContent = '# My Project\n\nCustom instructions for AI.\n\n## Rules\n\n- Be concise\n- Use TypeScript';
    fs.writeFileSync(claudeMdPath, customContent);

    await initCommand({ yes: true }, tmpDir);

    const result = fs.readFileSync(claudeMdPath, 'utf-8');
    // Custom content should be preserved
    expect(result).toContain('Custom instructions for AI.');
    expect(result).toContain('- Be concise');
    expect(result).toContain('- Use TypeScript');
    // Import directive should be appended
    expect(result).toContain('@.viberails/context.md');
  });

  it('does not duplicate import directive if already present', async () => {
    const claudeMdPath = path.join(tmpDir, 'CLAUDE.md');
    const contentWithImport = '# My Project\n\n@.viberails/context.md\n';
    fs.writeFileSync(claudeMdPath, contentWithImport);

    await initCommand({ yes: true }, tmpDir);

    const result = fs.readFileSync(claudeMdPath, 'utf-8');
    const importCount = (result.match(/@\.viberails\/context\.md/g) ?? []).length;
    expect(importCount).toBe(1);
  });
});
