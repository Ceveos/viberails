import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { computeStatistics } from './compute-statistics.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const fixturesDir = resolve(__dirname, '../../../tests/fixtures');

describe('computeStatistics', () => {
  it('counts files correctly for nextjs-15 fixture', async () => {
    const stats = await computeStatistics(join(fixturesDir, 'nextjs-15'));

    expect(stats.totalFiles).toBe(18);
    expect(stats.totalLines).toBeGreaterThan(0);
    expect(stats.averageFileLines).toBeGreaterThan(0);
  });

  it('reports correct file extensions', async () => {
    const stats = await computeStatistics(join(fixturesDir, 'nextjs-15'));

    expect(stats.filesByExtension).toHaveProperty('.ts');
    expect(stats.filesByExtension).toHaveProperty('.tsx');
    expect(stats.filesByExtension['.ts']).toBeGreaterThan(0);
    expect(stats.filesByExtension['.tsx']).toBeGreaterThan(0);
  });

  it('identifies largest files sorted descending', async () => {
    const stats = await computeStatistics(join(fixturesDir, 'nextjs-15'));

    expect(stats.largestFiles.length).toBeLessThanOrEqual(5);
    expect(stats.largestFiles.length).toBeGreaterThan(0);

    // Verify descending sort
    for (let i = 1; i < stats.largestFiles.length; i++) {
      expect(stats.largestFiles[i - 1].lines).toBeGreaterThanOrEqual(stats.largestFiles[i].lines);
    }

    // Each entry has path and lines
    for (const file of stats.largestFiles) {
      expect(file.path).toBeTruthy();
      expect(file.lines).toBeGreaterThan(0);
    }
  });

  describe('empty directory', () => {
    let tempDir: string;

    beforeAll(async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'viberails-stats-'));
      await mkdir(join(tempDir, 'empty-sub'), { recursive: true });
    });

    afterAll(async () => {
      await rm(tempDir, { recursive: true, force: true });
    });

    it('handles empty directory gracefully', async () => {
      const stats = await computeStatistics(tempDir);

      expect(stats.totalFiles).toBe(0);
      expect(stats.totalLines).toBe(0);
      expect(stats.averageFileLines).toBe(0);
      expect(stats.largestFiles).toEqual([]);
      expect(stats.filesByExtension).toEqual({});
    });
  });
});
