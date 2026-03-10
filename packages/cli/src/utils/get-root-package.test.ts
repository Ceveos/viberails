import type { PackageConfig } from '@viberails/types';
import { describe, expect, it } from 'vitest';
import { getRootPackage } from './get-root-package.js';

describe('getRootPackage', () => {
  it('returns the package with path === "."', () => {
    const packages: PackageConfig[] = [
      { name: 'web', path: 'apps/web' },
      { name: 'root', path: '.' },
      { name: 'api', path: 'apps/api' },
    ];
    expect(getRootPackage(packages)).toBe(packages[1]);
  });

  it('falls back to first package when no root exists', () => {
    const packages: PackageConfig[] = [
      { name: 'web', path: 'apps/web' },
      { name: 'api', path: 'apps/api' },
    ];
    expect(getRootPackage(packages)).toBe(packages[0]);
  });

  it('works with single-element array', () => {
    const packages: PackageConfig[] = [{ name: 'only', path: 'packages/only' }];
    expect(getRootPackage(packages)).toBe(packages[0]);
  });
});
