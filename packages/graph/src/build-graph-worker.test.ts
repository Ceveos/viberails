import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import type { ImportGraph, WorkspacePackage } from '@viberails/types';
import { describe, expect, it } from 'vitest';

const FIXTURES = join(import.meta.dirname, '../../..', 'tests/fixtures');
const MONOREPO = join(FIXTURES, 'monorepo-basic');

function makePackages(): WorkspacePackage[] {
  return [
    {
      name: '@mono/core',
      path: join(MONOREPO, 'packages/core'),
      relativePath: 'packages/core',
      internalDeps: [],
    },
    {
      name: '@mono/api',
      path: join(MONOREPO, 'packages/api'),
      relativePath: 'packages/api',
      internalDeps: ['@mono/core'],
    },
    {
      name: '@mono/web',
      path: join(MONOREPO, 'packages/web'),
      relativePath: 'packages/web',
      internalDeps: ['@mono/core'],
    },
  ];
}

describe('build-graph-worker', () => {
  it('produces the same result as in-process buildImportGraphSync', async () => {
    const { buildImportGraphSync } = await import('./build-graph.js');
    const expected = buildImportGraphSync(MONOREPO, { packages: makePackages() });

    // Run via the worker using the built dist file
    const workerPath = join(import.meta.dirname, '../dist/build-graph-worker.js');
    const result = await new Promise<ImportGraph>((resolve, reject) => {
      const worker = new Worker(workerPath, {
        workerData: { projectRoot: MONOREPO, options: { packages: makePackages() } },
      });
      worker.on('message', (msg: ImportGraph) => {
        resolve(msg);
        void worker.terminate();
      });
      worker.on('error', reject);
    });

    expect(result.nodes.length).toBe(expected.nodes.length);
    expect(result.edges.length).toBe(expected.edges.length);
    expect(result.cycles).toEqual(expected.cycles);
  });
});
