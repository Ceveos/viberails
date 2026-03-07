import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { computeRename, deduplicateRenames, executeRename } from './fix-naming.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fix-naming-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('computeRename', () => {
  it('computes rename from PascalCase to kebab-case', () => {
    fs.writeFileSync(path.join(tmpDir, 'UserProfile.tsx'), '');
    const result = computeRename('UserProfile.tsx', 'kebab-case', tmpDir);
    expect(result).not.toBeNull();
    expect(result?.newPath).toBe('user-profile.tsx');
  });

  it('preserves multi-dot extensions', () => {
    fs.writeFileSync(path.join(tmpDir, 'UserProfile.test.ts'), '');
    const result = computeRename('UserProfile.test.ts', 'kebab-case', tmpDir);
    expect(result).not.toBeNull();
    expect(result?.newPath).toBe('user-profile.test.ts');
  });

  it('returns null when no rename needed', () => {
    fs.writeFileSync(path.join(tmpDir, 'user-profile.ts'), '');
    const result = computeRename('user-profile.ts', 'kebab-case', tmpDir);
    expect(result).toBeNull();
  });

  it('returns null when target already exists', () => {
    fs.writeFileSync(path.join(tmpDir, 'UserProfile.ts'), '');
    fs.writeFileSync(path.join(tmpDir, 'user-profile.ts'), '');
    const result = computeRename('UserProfile.ts', 'kebab-case', tmpDir);
    expect(result).toBeNull();
  });

  it('handles files in subdirectories', () => {
    const subdir = path.join(tmpDir, 'src');
    fs.mkdirSync(subdir);
    fs.writeFileSync(path.join(subdir, 'MyComponent.tsx'), '');
    const result = computeRename('src/MyComponent.tsx', 'kebab-case', tmpDir);
    expect(result).not.toBeNull();
    expect(result?.newPath).toBe(path.join('src', 'my-component.tsx'));
  });
});

describe('executeRename', () => {
  it('renames a file on disk', () => {
    fs.writeFileSync(path.join(tmpDir, 'OldName.ts'), 'content');
    const rename = {
      oldPath: 'OldName.ts',
      newPath: 'old-name.ts',
      oldAbsPath: path.join(tmpDir, 'OldName.ts'),
      newAbsPath: path.join(tmpDir, 'old-name.ts'),
    };
    expect(executeRename(rename)).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'old-name.ts'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'OldName.ts'))).toBe(false);
  });

  it('returns false when target already exists', () => {
    fs.writeFileSync(path.join(tmpDir, 'OldName.ts'), 'old');
    fs.writeFileSync(path.join(tmpDir, 'old-name.ts'), 'existing');
    const rename = {
      oldPath: 'OldName.ts',
      newPath: 'old-name.ts',
      oldAbsPath: path.join(tmpDir, 'OldName.ts'),
      newAbsPath: path.join(tmpDir, 'old-name.ts'),
    };
    expect(executeRename(rename)).toBe(false);
  });
});

describe('deduplicateRenames', () => {
  it('removes duplicate target paths', () => {
    const renames = [
      {
        oldPath: 'A.ts',
        newPath: 'a.ts',
        oldAbsPath: '/tmp/A.ts',
        newAbsPath: '/tmp/a.ts',
      },
      {
        oldPath: 'a.tsx',
        newPath: 'a.ts',
        oldAbsPath: '/tmp/a.tsx',
        newAbsPath: '/tmp/a.ts',
      },
    ];
    const result = deduplicateRenames(renames);
    expect(result).toHaveLength(1);
    expect(result[0].oldPath).toBe('A.ts');
  });
});
