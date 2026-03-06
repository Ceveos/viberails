import { describe, expect, it } from 'vitest';
import { detectCycles } from './detect-cycles.js';

describe('detectCycles', () => {
  it('returns empty for acyclic graph', () => {
    const edges = [
      { source: 'A', target: 'B' },
      { source: 'B', target: 'C' },
    ];
    expect(detectCycles(edges)).toEqual([]);
  });

  it('detects a simple two-node cycle', () => {
    const edges = [
      { source: 'A', target: 'B' },
      { source: 'B', target: 'A' },
    ];
    const cycles = detectCycles(edges);

    expect(cycles.length).toBeGreaterThanOrEqual(1);
    // One cycle should contain both A and B
    const hasCycle = cycles.some((cycle) => cycle.includes('A') && cycle.includes('B'));
    expect(hasCycle).toBe(true);
  });

  it('detects a triangle cycle', () => {
    const edges = [
      { source: 'A', target: 'B' },
      { source: 'B', target: 'C' },
      { source: 'C', target: 'A' },
    ];
    const cycles = detectCycles(edges);

    expect(cycles.length).toBeGreaterThanOrEqual(1);
    const hasCycle = cycles.some(
      (cycle) => cycle.includes('A') && cycle.includes('B') && cycle.includes('C'),
    );
    expect(hasCycle).toBe(true);
  });

  it('detects multiple independent cycles', () => {
    const edges = [
      { source: 'A', target: 'B' },
      { source: 'B', target: 'A' },
      { source: 'X', target: 'Y' },
      { source: 'Y', target: 'X' },
    ];
    const cycles = detectCycles(edges);
    expect(cycles.length).toBeGreaterThanOrEqual(2);
  });

  it('detects self-import cycle', () => {
    const edges = [{ source: 'A', target: 'A' }];
    const cycles = detectCycles(edges);

    expect(cycles.length).toBeGreaterThanOrEqual(1);
    expect(cycles.some((c) => c.includes('A'))).toBe(true);
  });
});
