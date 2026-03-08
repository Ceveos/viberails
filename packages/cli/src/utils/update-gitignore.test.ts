import * as fs from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { updateGitignore } from './update-gitignore.js';

describe('updateGitignore', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'viberails-gitignore-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('creates .gitignore with viberails entry when none exists', () => {
    updateGitignore(tempDir);
    const content = fs.readFileSync(join(tempDir, '.gitignore'), 'utf-8');
    expect(content).toContain('.viberails/scan-result.json');
  });

  it('appends to existing .gitignore', () => {
    fs.writeFileSync(join(tempDir, '.gitignore'), 'node_modules\n');
    updateGitignore(tempDir);
    const content = fs.readFileSync(join(tempDir, '.gitignore'), 'utf-8');
    expect(content).toContain('node_modules');
    expect(content).toContain('.viberails/scan-result.json');
  });

  it('does not duplicate entry if already present', () => {
    fs.writeFileSync(join(tempDir, '.gitignore'), '.viberails/scan-result.json\n');
    updateGitignore(tempDir);
    const content = fs.readFileSync(join(tempDir, '.gitignore'), 'utf-8');
    const count = content.split('.viberails/scan-result.json').length - 1;
    expect(count).toBe(1);
  });
});
