import { describe, expect, it } from 'vitest';
import { filterHighConfidence } from './filter-confidence.js';

describe('filterHighConfidence', () => {
  it('returns all conventions when no meta is provided', () => {
    const conventions = { fileNaming: 'kebab-case', hookNaming: 'use-*' };
    expect(filterHighConfidence(conventions)).toEqual(conventions);
  });

  it('keeps high-confidence conventions', () => {
    const conventions = { fileNaming: 'kebab-case', hookNaming: 'use-*' };
    const meta = {
      fileNaming: { confidence: 'high' },
      hookNaming: { confidence: 'high' },
    };
    expect(filterHighConfidence(conventions, meta)).toEqual(conventions);
  });

  it('removes medium and low confidence conventions', () => {
    const conventions = {
      fileNaming: 'kebab-case',
      componentNaming: 'PascalCase',
      hookNaming: 'use-*',
    };
    const meta = {
      fileNaming: { confidence: 'high' },
      componentNaming: { confidence: 'medium' },
      hookNaming: { confidence: 'low' },
    };
    expect(filterHighConfidence(conventions, meta)).toEqual({ fileNaming: 'kebab-case' });
  });

  it('keeps conventions not present in meta', () => {
    const conventions = { fileNaming: 'kebab-case', importAlias: '@/*' };
    const meta = { fileNaming: { confidence: 'high' } };
    expect(filterHighConfidence(conventions, meta)).toEqual(conventions);
  });
});
