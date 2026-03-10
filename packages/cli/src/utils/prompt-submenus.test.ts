import { describe, expect, it } from 'vitest';
import { FILE_NAMING_OPTIONS } from './prompt-submenus.js';

describe('FILE_NAMING_OPTIONS', () => {
  it('contains the four standard naming conventions', () => {
    const values = FILE_NAMING_OPTIONS.map((o) => o.value);
    expect(values).toEqual(['kebab-case', 'camelCase', 'PascalCase', 'snake_case']);
  });
});
