import { configSchema } from '@viberails/config';
import { describe, expect, it } from 'vitest';
import { serializeSchema } from './serialize-schema.js';

describe('serializeSchema', () => {
  it('serializes configSchema to valid JSON with correct fields', () => {
    const json = serializeSchema(configSchema);
    const parsed = JSON.parse(json);
    expect(parsed.$schema).toBe('http://json-schema.org/draft-07/schema#');
    expect(parsed.$id).toBe('https://viberails.sh/schema/v1.json');
    expect(parsed.type).toBe('object');
    expect(parsed.required).toContain('version');
    expect(parsed.required).toContain('name');
  });

  it('appends trailing newline', () => {
    const json = serializeSchema({ test: true });
    expect(json.endsWith('\n')).toBe(true);
  });

  it('produces deterministic output', () => {
    const first = serializeSchema(configSchema);
    const second = serializeSchema(configSchema);
    expect(first).toBe(second);
  });
});
