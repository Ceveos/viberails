import { describe, expect, it } from 'vitest';
import { inferCoverageCommand } from './infer-coverage-command.js';

describe('inferCoverageCommand', () => {
  it('returns vitest command for vitest runner', () => {
    const cmd = inferCoverageCommand('vitest@4');
    expect(cmd).toContain('vitest');
    expect(cmd).toContain('--coverage');
  });

  it('returns jest command for jest runner', () => {
    const cmd = inferCoverageCommand('jest@29');
    expect(cmd).toContain('jest');
    expect(cmd).toContain('--coverage');
  });

  it('returns undefined for unsupported runner', () => {
    expect(inferCoverageCommand('mocha@10')).toBeUndefined();
  });

  it('returns undefined for undefined input', () => {
    expect(inferCoverageCommand(undefined)).toBeUndefined();
  });

  it('handles runner name without version', () => {
    const cmd = inferCoverageCommand('vitest');
    expect(cmd).toContain('vitest');
  });
});
