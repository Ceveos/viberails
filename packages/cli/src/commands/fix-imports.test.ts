import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scanForAliasImports, updateImportsAfterRenames } from './fix-imports.js';
import type { RenameRecord } from './fix-naming.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fix-imports-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeFile(relPath: string, content: string): void {
  const abs = path.join(tmpDir, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(tmpDir, relPath), 'utf-8');
}

function makeRename(oldRel: string, newRel: string): RenameRecord {
  return {
    oldPath: oldRel,
    newPath: newRel,
    oldAbsPath: path.join(tmpDir, oldRel),
    newAbsPath: path.join(tmpDir, newRel),
  };
}

describe('updateImportsAfterRenames', () => {
  it('updates static import specifiers', async () => {
    // The renamed file (already renamed on disk)
    writeFile('src/user-profile.ts', 'export const name = "user";');
    // A consumer that still references the old name
    writeFile('src/app.ts', "import { name } from './UserProfile';\nconsole.log(name);\n");

    const renames = [makeRename('src/UserProfile.ts', 'src/user-profile.ts')];
    const { updates } = await updateImportsAfterRenames(renames, tmpDir);

    expect(updates).toHaveLength(1);
    expect(updates[0].oldSpecifier).toBe('./UserProfile');
    expect(updates[0].newSpecifier).toBe('./user-profile');

    const content = readFile('src/app.ts');
    expect(content).toContain('./user-profile');
    expect(content).not.toContain('./UserProfile');
  });

  it('updates import specifiers with .js extension', async () => {
    writeFile('src/user-profile.ts', 'export const x = 1;');
    writeFile('src/app.ts', "import { x } from './UserProfile.js';\n");

    const renames = [makeRename('src/UserProfile.ts', 'src/user-profile.ts')];
    const { updates } = await updateImportsAfterRenames(renames, tmpDir);

    expect(updates).toHaveLength(1);
    expect(updates[0].newSpecifier).toBe('./user-profile.js');
  });

  it('updates re-exports', async () => {
    writeFile('src/user-profile.ts', 'export const x = 1;');
    writeFile('src/index.ts', "export { x } from './UserProfile';\n");

    const renames = [makeRename('src/UserProfile.ts', 'src/user-profile.ts')];
    const { updates } = await updateImportsAfterRenames(renames, tmpDir);

    expect(updates).toHaveLength(1);
    const content = readFile('src/index.ts');
    expect(content).toContain('./user-profile');
  });

  it('updates dynamic imports', async () => {
    writeFile('src/user-profile.ts', 'export const x = 1;');
    writeFile('src/app.ts', "const mod = import('./UserProfile');\n");

    const renames = [makeRename('src/UserProfile.ts', 'src/user-profile.ts')];
    const { updates } = await updateImportsAfterRenames(renames, tmpDir);

    expect(updates).toHaveLength(1);
    const content = readFile('src/app.ts');
    expect(content).toContain('./user-profile');
  });

  it('updates type-only imports', async () => {
    writeFile('src/user-profile.ts', 'export type User = { name: string };');
    writeFile('src/app.ts', "import type { User } from './UserProfile';\n");

    const renames = [makeRename('src/UserProfile.ts', 'src/user-profile.ts')];
    const { updates } = await updateImportsAfterRenames(renames, tmpDir);

    expect(updates).toHaveLength(1);
    const content = readFile('src/app.ts');
    expect(content).toContain('./user-profile');
  });

  it('does not modify non-matching imports', async () => {
    writeFile('src/user-profile.ts', 'export const x = 1;');
    writeFile('src/other.ts', 'export const y = 2;');
    writeFile('src/app.ts', "import { y } from './other';\n");

    const renames = [makeRename('src/UserProfile.ts', 'src/user-profile.ts')];
    const { updates } = await updateImportsAfterRenames(renames, tmpDir);

    expect(updates).toHaveLength(0);
    const content = readFile('src/app.ts');
    expect(content).toContain('./other');
  });

  it('returns empty array when no renames', async () => {
    const result = await updateImportsAfterRenames([], tmpDir);
    expect(result).toEqual({ updates: [], skippedAliases: [] });
  });

  it('handles multiple renames', async () => {
    writeFile('src/user-profile.ts', 'export const x = 1;');
    writeFile('src/admin-panel.ts', 'export const y = 2;');
    writeFile(
      'src/app.ts',
      "import { x } from './UserProfile';\nimport { y } from './AdminPanel';\n",
    );

    const renames = [
      makeRename('src/UserProfile.ts', 'src/user-profile.ts'),
      makeRename('src/AdminPanel.ts', 'src/admin-panel.ts'),
    ];
    const { updates } = await updateImportsAfterRenames(renames, tmpDir);

    expect(updates).toHaveLength(2);
    const content = readFile('src/app.ts');
    expect(content).toContain('./user-profile');
    expect(content).toContain('./admin-panel');
  });

  it('detects aliased imports that reference renamed files', async () => {
    writeFile('src/user-profile.ts', 'export const x = 1;');
    writeFile('src/app.ts', "import { x } from '@/UserProfile';\nimport { y } from '@/other';\n");

    const renames = [makeRename('src/UserProfile.ts', 'src/user-profile.ts')];
    const { updates, skippedAliases } = await updateImportsAfterRenames(renames, tmpDir);

    expect(updates).toHaveLength(0);
    expect(skippedAliases).toHaveLength(1);
    expect(skippedAliases[0].specifier).toBe('@/UserProfile');
  });
});

describe('scanForAliasImports', () => {
  it('detects aliased imports before renames are applied', async () => {
    writeFile('src/UserProfile.ts', 'export const x = 1;');
    writeFile('src/app.ts', "import { x } from '@/UserProfile';\nimport { y } from '@/other';\n");

    const renames = [makeRename('src/UserProfile.ts', 'src/user-profile.ts')];
    const aliases = await scanForAliasImports(renames, tmpDir);

    expect(aliases).toHaveLength(1);
    expect(aliases[0].specifier).toBe('@/UserProfile');
  });

  it('returns empty array when no aliases reference renamed files', async () => {
    writeFile('src/UserProfile.ts', 'export const x = 1;');
    writeFile('src/app.ts', "import { x } from './UserProfile';\n");

    const renames = [makeRename('src/UserProfile.ts', 'src/user-profile.ts')];
    const aliases = await scanForAliasImports(renames, tmpDir);

    expect(aliases).toHaveLength(0);
  });
});
