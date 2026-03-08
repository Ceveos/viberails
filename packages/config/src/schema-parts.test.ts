import { describe, expect, it } from 'vitest';
import {
  boundarySchema,
  conventionsSchema,
  coverageSchema,
  defaultsSchema,
  packageItemSchema,
  stackSchema,
  structureSchema,
} from './schema-parts.js';

describe('schema-parts', () => {
  it('boundarySchema requires deny field', () => {
    expect(boundarySchema.required).toContain('deny');
    expect(boundarySchema.properties.deny.type).toBe('object');
  });

  it('stackSchema includes all expected fields', () => {
    const fields = Object.keys(stackSchema.properties);
    expect(fields).toContain('framework');
    expect(fields).toContain('language');
    expect(fields).toContain('testRunner');
    expect(fields).toContain('packageManager');
  });

  it('structureSchema includes srcDir and testPattern', () => {
    expect(structureSchema.properties.srcDir.type).toBe('string');
    expect(structureSchema.properties.testPattern.type).toBe('string');
  });

  it('conventionsSchema includes fileNaming', () => {
    expect(conventionsSchema.properties.fileNaming.type).toBe('string');
  });

  it('coverageSchema includes command and summaryPath', () => {
    expect(coverageSchema.properties.command.type).toBe('string');
    expect(coverageSchema.properties.summaryPath.type).toBe('string');
  });

  it('packageItemSchema requires name and path', () => {
    expect(packageItemSchema.required).toContain('name');
    expect(packageItemSchema.required).toContain('path');
  });

  it('defaultsSchema has stack, structure, conventions, and coverage', () => {
    const fields = Object.keys(defaultsSchema.properties);
    expect(fields).toContain('stack');
    expect(fields).toContain('structure');
    expect(fields).toContain('conventions');
    expect(fields).toContain('coverage');
  });
});
