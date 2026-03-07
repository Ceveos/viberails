import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { scanPackage } from './scan-package.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const fixturesDir = resolve(__dirname, '../../../tests/fixtures');
const monorepoDir = join(fixturesDir, 'monorepo-nextjs-expo');

describe('scanPackage', () => {
  it('detects Next.js stack for web package', async () => {
    const result = await scanPackage(join(monorepoDir, 'apps', 'web'), '@app/web', 'apps/web');
    expect(result.stack.framework?.name).toBe('nextjs');
    expect(result.stack.language.name).toBe('typescript');
    expect(result.name).toBe('@app/web');
    expect(result.relativePath).toBe('apps/web');
  });

  it('detects Expo stack for mobile package', async () => {
    const result = await scanPackage(
      join(monorepoDir, 'apps', 'mobile'),
      '@app/mobile',
      'apps/mobile',
    );
    expect(result.stack.framework?.name).toBe('expo');
  });

  it('detects typescript when passed as rootDeps', async () => {
    const result = await scanPackage(
      join(monorepoDir, 'packages', 'shared'),
      '@app/shared',
      'packages/shared',
      { typescript: '^5.7.0' },
    );
    expect(result.stack.language.name).toBe('typescript');
  });

  it('detects components directory within web package', async () => {
    const result = await scanPackage(join(monorepoDir, 'apps', 'web'), '@app/web', 'apps/web');
    const compDir = result.structure.directories.find((d) => d.role === 'components');
    expect(compDir).toBeDefined();
    expect(compDir?.path).toBe('components');
  });

  it('returns absolute root path', async () => {
    const result = await scanPackage(join(monorepoDir, 'apps', 'web'), '@app/web', 'apps/web');
    expect(result.root).toBe(resolve(monorepoDir, 'apps', 'web'));
  });
});
