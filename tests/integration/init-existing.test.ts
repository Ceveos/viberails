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

  it('appends context reference to an existing CLAUDE.md', async () => {
    const claudeMdPath = path.join(tmpDir, 'CLAUDE.md');
    const customContent =
      '# My Project\n\nCustom instructions for AI.\n\n## Rules\n\n- Be concise\n- Use TypeScript';
    fs.writeFileSync(claudeMdPath, customContent);

    await initCommand({ yes: true }, tmpDir);

    const result = fs.readFileSync(claudeMdPath, 'utf-8');
    // Original content preserved, reference appended
    expect(result).toContain(customContent.trimEnd());
    expect(result).toContain('@.viberails/context.md');
  });

  it('does not duplicate reference if already present', async () => {
    const claudeMdPath = path.join(tmpDir, 'CLAUDE.md');
    const contentWithRef = '# My Project\n\n@.viberails/context.md\n';
    fs.writeFileSync(claudeMdPath, contentWithRef);

    await initCommand({ yes: true }, tmpDir);

    const result = fs.readFileSync(claudeMdPath, 'utf-8');
    // Should not have duplicate references
    const matches = result.match(/@\.viberails\/context\.md/g);
    expect(matches).toHaveLength(1);
  });

  it('creates CLAUDE.md with reference when none exists', async () => {
    const claudeMdPath = path.join(tmpDir, 'CLAUDE.md');
    if (fs.existsSync(claudeMdPath)) {
      fs.unlinkSync(claudeMdPath);
    }

    await initCommand({ yes: true }, tmpDir);

    expect(fs.existsSync(claudeMdPath)).toBe(true);
    const result = fs.readFileSync(claudeMdPath, 'utf-8');
    expect(result).toContain('@.viberails/context.md');
  });
});
