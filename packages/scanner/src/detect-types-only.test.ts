import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { detectTypesOnly } from './detect-types-only.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'types-only-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writePkg(deps?: Record<string, string>): void {
  const pkg: Record<string, unknown> = { name: 'test' };
  if (deps !== undefined) pkg.dependencies = deps;
  fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(pkg));
}

describe('detectTypesOnly', () => {
  it('returns true for scoped types package with no dependencies', async () => {
    writePkg();
    expect(await detectTypesOnly(tmpDir, '@viberails/types')).toBe(true);
  });

  it('returns true for unscoped types package with no dependencies', async () => {
    writePkg();
    expect(await detectTypesOnly(tmpDir, 'shared-types')).toBe(true);
  });

  it('returns false when package has runtime dependencies', async () => {
    writePkg({ lodash: '^4.0.0' });
    expect(await detectTypesOnly(tmpDir, '@viberails/types')).toBe(false);
  });

  it('returns false for non-types package with no dependencies', async () => {
    writePkg();
    expect(await detectTypesOnly(tmpDir, '@viberails/utils')).toBe(false);
  });

  it('returns false when package.json is missing', async () => {
    expect(await detectTypesOnly(tmpDir, '@foo/types')).toBe(false);
  });

  it('returns true for name with types as middle segment', async () => {
    writePkg();
    expect(await detectTypesOnly(tmpDir, '@app/types-shared')).toBe(true);
  });
});
