import { join } from 'node:path';
import type { WorkspacePackage } from '@viberails/types';
import { describe, expect, it } from 'vitest';
import { buildImportGraph } from './build-graph.js';

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

describe('buildImportGraph', () => {
  it('finds all source file nodes', async () => {
    const graph = await buildImportGraph(MONOREPO, {
      packages: makePackages(),
    });

    // 6 source files: core/src/{index,math}.ts, api/src/{index,handler}.ts, web/src/{index,app}.tsx
    expect(graph.nodes.length).toBe(6);
  });

  it('detects import edges', async () => {
    const graph = await buildImportGraph(MONOREPO, {
      packages: makePackages(),
    });

    // Each package has at least one internal import
    expect(graph.edges.length).toBeGreaterThanOrEqual(3);
  });

  it('detects cross-package edges', async () => {
    const graph = await buildImportGraph(MONOREPO, {
      packages: makePackages(),
    });

    // handler.ts and app.tsx both import @mono/core
    const crossPackageEdges = graph.edges.filter((e) => e.specifier === '@mono/core');
    expect(crossPackageEdges.length).toBe(2);
  });

  it('finds no cycles in clean fixture', async () => {
    const graph = await buildImportGraph(MONOREPO, {
      packages: makePackages(),
    });

    expect(graph.cycles).toEqual([]);
  });

  it('includes workspace packages in result', async () => {
    const packages = makePackages();
    const graph = await buildImportGraph(MONOREPO, { packages });

    expect(graph.packages).toEqual(packages);
  });

  it('assigns correct package names to nodes', async () => {
    const graph = await buildImportGraph(MONOREPO, {
      packages: makePackages(),
    });

    const coreNodes = graph.nodes.filter((n) => n.packageName === '@mono/core');
    expect(coreNodes.length).toBe(2); // index.ts and math.ts
  });
});
