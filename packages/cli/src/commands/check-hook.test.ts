import { describe, expect, it } from 'vitest';
import { parseHookFilePath } from './check-hook.js';

describe('parseHookFilePath', () => {
  it('extracts file_path from valid hook JSON', () => {
    const input = JSON.stringify({ tool_input: { file_path: '/src/foo.ts' } });
    expect(parseHookFilePath(input)).toBe('/src/foo.ts');
  });

  it('returns undefined for empty string', () => {
    expect(parseHookFilePath('')).toBeUndefined();
  });

  it('returns undefined for whitespace-only string', () => {
    expect(parseHookFilePath('   \n  ')).toBeUndefined();
  });

  it('returns undefined for invalid JSON', () => {
    expect(parseHookFilePath('{not valid')).toBeUndefined();
  });

  it('returns undefined when tool_input is missing', () => {
    expect(parseHookFilePath(JSON.stringify({ other: 'data' }))).toBeUndefined();
  });

  it('returns undefined when file_path is missing from tool_input', () => {
    expect(parseHookFilePath(JSON.stringify({ tool_input: { content: 'hello' } }))).toBeUndefined();
  });

  it('returns undefined when tool_input.file_path is null', () => {
    expect(parseHookFilePath(JSON.stringify({ tool_input: { file_path: null } }))).toBeUndefined();
  });

  it('handles nested JSON with extra fields', () => {
    const input = JSON.stringify({
      tool_name: 'Edit',
      tool_input: { file_path: '/src/bar.ts', old_string: 'x', new_string: 'y' },
    });
    expect(parseHookFilePath(input)).toBe('/src/bar.ts');
  });
});
