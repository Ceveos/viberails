import { describe, expect, it } from 'vitest';
import {
  handleAdvancedNaming,
  handleBoundaries,
  handleCoverage,
  handleFileNaming,
  handleIntegrations,
  handleMissingTests,
  handlePackageOverrides,
} from './prompt-main-menu-handlers.js';

describe('prompt-main-menu-handlers exports', () => {
  it('exports all handler functions', () => {
    expect(handleAdvancedNaming).toBeTypeOf('function');
    expect(handleBoundaries).toBeTypeOf('function');
    expect(handleCoverage).toBeTypeOf('function');
    expect(handleFileNaming).toBeTypeOf('function');
    expect(handleIntegrations).toBeTypeOf('function');
    expect(handleMissingTests).toBeTypeOf('function');
    expect(handlePackageOverrides).toBeTypeOf('function');
  });
});
