import { describe, expect, it } from 'vitest';
import {
  BACKEND_MAPPINGS,
  FRAMEWORK_MAPPINGS,
  LIBRARY_MAPPINGS,
  LOCK_FILE_MAP,
  ORM_MAPPINGS,
  STYLING_MAPPINGS,
} from './stack-mappings.js';

describe('stack-mappings', () => {
  it('FRAMEWORK_MAPPINGS is non-empty with required fields', () => {
    expect(FRAMEWORK_MAPPINGS.length).toBeGreaterThan(0);
    for (const m of FRAMEWORK_MAPPINGS) {
      expect(m.dep).toBeTruthy();
      expect(m.name).toBeTruthy();
    }
  });

  it('BACKEND_MAPPINGS is non-empty', () => {
    expect(BACKEND_MAPPINGS.length).toBeGreaterThan(0);
  });

  it('ORM_MAPPINGS is non-empty', () => {
    expect(ORM_MAPPINGS.length).toBeGreaterThan(0);
  });

  it('STYLING_MAPPINGS is non-empty', () => {
    expect(STYLING_MAPPINGS.length).toBeGreaterThan(0);
  });

  it('LIBRARY_MAPPINGS includes common libraries', () => {
    const names = LIBRARY_MAPPINGS.map((m) => m.name);
    expect(names).toContain('zod');
    expect(names).toContain('trpc');
    expect(names).toContain('react-query');
  });

  it('LOCK_FILE_MAP covers major package managers', () => {
    const names = LOCK_FILE_MAP.map((m) => m.name);
    expect(names).toContain('pnpm');
    expect(names).toContain('npm');
    expect(names).toContain('yarn');
  });
});
