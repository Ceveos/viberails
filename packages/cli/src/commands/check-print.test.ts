import type { CheckViolation } from '@viberails/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { printGroupedViolations, printSummary } from './check-print.js';

describe('printGroupedViolations', () => {
  let logs: string[];

  beforeEach(() => {
    logs = [];
    vi.spyOn(console, 'log').mockImplementation((msg: string) => {
      logs.push(msg);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints violations grouped by rule', () => {
    const violations: CheckViolation[] = [
      { file: 'a.ts', rule: 'file-size', message: '400 lines', severity: 'warn' },
      { file: 'b.ts', rule: 'file-naming', message: 'not kebab', severity: 'warn' },
    ];
    printGroupedViolations(violations);
    expect(logs).toHaveLength(2);
    expect(logs[0]).toContain('file-size');
    expect(logs[1]).toContain('file-naming');
  });

  it('respects limit parameter', () => {
    const violations: CheckViolation[] = [
      { file: 'a.ts', rule: 'file-size', message: 'too long', severity: 'warn' },
      { file: 'b.ts', rule: 'file-size', message: 'too long', severity: 'warn' },
      { file: 'c.ts', rule: 'file-size', message: 'too long', severity: 'warn' },
    ];
    printGroupedViolations(violations, 1);
    expect(logs).toHaveLength(2); // 1 violation + "... and 2 more"
    expect(logs[1]).toContain('2 more');
  });

  it('uses error icon for error severity', () => {
    const violations: CheckViolation[] = [
      { file: 'a.ts', rule: 'file-size', message: 'too long', severity: 'error' },
    ];
    printGroupedViolations(violations);
    expect(logs).toHaveLength(1);
  });
});

describe('printSummary', () => {
  let logs: string[];

  beforeEach(() => {
    logs = [];
    vi.spyOn(console, 'log').mockImplementation((msg: string) => {
      logs.push(msg);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints singular for 1 violation', () => {
    const violations: CheckViolation[] = [
      { file: 'a.ts', rule: 'file-size', message: 'too long', severity: 'warn' },
    ];
    printSummary(violations);
    expect(logs[0]).toContain('1 violation found');
    expect(logs[0]).toContain('1 file-size');
  });

  it('prints plural for multiple violations', () => {
    const violations: CheckViolation[] = [
      { file: 'a.ts', rule: 'file-size', message: 'too long', severity: 'warn' },
      { file: 'b.ts', rule: 'file-naming', message: 'bad name', severity: 'warn' },
    ];
    printSummary(violations);
    expect(logs[0]).toContain('2 violations found');
  });
});
