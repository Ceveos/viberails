import { describe, expect, it } from 'vitest';
import type { ImportEdge, ImportGraph, ImportGraphNode, WorkspacePackage } from '@viberails/types';
import { inferBoundaries } from './infer-boundaries.js';

/** Helper to create a minimal node. */
function node(filePath: string, relativePath: string, packageName?: string): ImportGraphNode {
  return { filePath, relativePath, packageName };
}

/** Helper to create a minimal edge. */
function edge(source: string, target: string, specifier = ''): ImportEdge {
  return { source, target, specifier, typeOnly: false, dynamic: false, line: 1 };
}

describe('inferBoundaries — monorepo', () => {
  function makeMonorepoGraph(overrides?: Partial<ImportGraph>): ImportGraph {
    const packages: WorkspacePackage[] = [
      {
        name: '@mono/core',
        path: '/repo/packages/core',
        relativePath: 'packages/core',
        internalDeps: [],
      },
      {
        name: '@mono/api',
        path: '/repo/packages/api',
        relativePath: 'packages/api',
        internalDeps: ['@mono/core'],
      },
      {
        name: '@mono/web',
        path: '/repo/packages/web',
        relativePath: 'packages/web',
        internalDeps: ['@mono/core'],
      },
    ];

    const nodes: ImportGraphNode[] = [
      node('/repo/packages/core/src/index.ts', 'src/index.ts', '@mono/core'),
      node('/repo/packages/api/src/handler.ts', 'src/handler.ts', '@mono/api'),
      node('/repo/packages/web/src/app.tsx', 'src/app.tsx', '@mono/web'),
    ];

    // api→core and web→core (clean monorepo, no cross-imports between api and web)
    const edges: ImportEdge[] = [
      edge('/repo/packages/api/src/handler.ts', '/repo/packages/core/src/index.ts', '@mono/core'),
      edge('/repo/packages/web/src/app.tsx', '/repo/packages/core/src/index.ts', '@mono/core'),
    ];

    return { nodes, edges, packages, cycles: [], ...overrides };
  }

  it('infers that api and web cannot import each other', () => {
    const rules = inferBoundaries(makeMonorepoGraph());

    const apiToWeb = rules.find((r) => r.from === '@mono/api' && r.to === '@mono/web');
    const webToApi = rules.find((r) => r.from === '@mono/web' && r.to === '@mono/api');
    expect(apiToWeb).toEqual({
      from: '@mono/api',
      to: '@mono/web',
      allow: false,
      reason: '@mono/api should not depend on @mono/web',
    });
    expect(webToApi).toEqual({
      from: '@mono/web',
      to: '@mono/api',
      allow: false,
      reason: '@mono/web should not depend on @mono/api',
    });
  });

  it('creates allow rules for declared dependencies with actual imports', () => {
    const rules = inferBoundaries(makeMonorepoGraph());

    const apiToCore = rules.find((r) => r.from === '@mono/api' && r.to === '@mono/core');
    const webToCore = rules.find((r) => r.from === '@mono/web' && r.to === '@mono/core');
    expect(apiToCore).toEqual({ from: '@mono/api', to: '@mono/core', allow: true });
    expect(webToCore).toEqual({ from: '@mono/web', to: '@mono/core', allow: true });
  });

  it('creates disallow rules for core importing from api or web', () => {
    const rules = inferBoundaries(makeMonorepoGraph());

    const coreToApi = rules.find((r) => r.from === '@mono/core' && r.to === '@mono/api');
    const coreToWeb = rules.find((r) => r.from === '@mono/core' && r.to === '@mono/web');
    expect(coreToApi?.allow).toBe(false);
    expect(coreToWeb?.allow).toBe(false);
  });

  it('does not create disallow rules when all packages import from shared', () => {
    const packages: WorkspacePackage[] = [
      {
        name: '@mono/shared',
        path: '/repo/packages/shared',
        relativePath: 'packages/shared',
        internalDeps: [],
      },
      {
        name: '@mono/app',
        path: '/repo/packages/app',
        relativePath: 'packages/app',
        internalDeps: ['@mono/shared'],
      },
    ];

    const nodes: ImportGraphNode[] = [
      node('/repo/packages/shared/src/index.ts', 'src/index.ts', '@mono/shared'),
      node('/repo/packages/app/src/main.ts', 'src/main.ts', '@mono/app'),
    ];

    const edges: ImportEdge[] = [
      edge('/repo/packages/app/src/main.ts', '/repo/packages/shared/src/index.ts', '@mono/shared'),
    ];

    const graph: ImportGraph = { nodes, edges, packages, cycles: [] };
    const rules = inferBoundaries(graph);

    // shared→app should be disallowed (no imports, not a dep)
    const sharedToApp = rules.find((r) => r.from === '@mono/shared' && r.to === '@mono/app');
    expect(sharedToApp?.allow).toBe(false);

    // app→shared should be allowed (imports exist, declared dep)
    const appToShared = rules.find((r) => r.from === '@mono/app' && r.to === '@mono/shared');
    expect(appToShared?.allow).toBe(true);
  });

  it('skips rules for undeclared imports (would produce immediate violations)', () => {
    const packages: WorkspacePackage[] = [
      { name: '@mono/a', path: '/repo/packages/a', relativePath: 'packages/a', internalDeps: [] },
      { name: '@mono/b', path: '/repo/packages/b', relativePath: 'packages/b', internalDeps: [] },
    ];

    const nodes: ImportGraphNode[] = [
      node('/repo/packages/a/src/index.ts', 'src/index.ts', '@mono/a'),
      node('/repo/packages/b/src/index.ts', 'src/index.ts', '@mono/b'),
    ];

    // a imports from b but b is NOT a declared dependency
    const edges: ImportEdge[] = [
      edge('/repo/packages/a/src/index.ts', '/repo/packages/b/src/index.ts', '@mono/b'),
    ];

    const graph: ImportGraph = { nodes, edges, packages, cycles: [] };
    const rules = inferBoundaries(graph);

    // Should NOT create a disallow rule for a→b (would immediately violate)
    // Should NOT create an allow rule (b is not a declared dep of a)
    const aToB = rules.find((r) => r.from === '@mono/a' && r.to === '@mono/b');
    expect(aToB).toBeUndefined();
  });

  it('counts type-only imports as real imports', () => {
    const packages: WorkspacePackage[] = [
      {
        name: '@mono/types',
        path: '/repo/packages/types',
        relativePath: 'packages/types',
        internalDeps: [],
      },
      {
        name: '@mono/app',
        path: '/repo/packages/app',
        relativePath: 'packages/app',
        internalDeps: ['@mono/types'],
      },
    ];

    const nodes: ImportGraphNode[] = [
      node('/repo/packages/types/src/index.ts', 'src/index.ts', '@mono/types'),
      node('/repo/packages/app/src/main.ts', 'src/main.ts', '@mono/app'),
    ];

    const edges: ImportEdge[] = [
      {
        source: '/repo/packages/app/src/main.ts',
        target: '/repo/packages/types/src/index.ts',
        specifier: '@mono/types',
        typeOnly: true,
        dynamic: false,
        line: 1,
      },
    ];

    const graph: ImportGraph = { nodes, edges, packages, cycles: [] };
    const rules = inferBoundaries(graph);

    const appToTypes = rules.find((r) => r.from === '@mono/app' && r.to === '@mono/types');
    expect(appToTypes?.allow).toBe(true);
  });
});

describe('inferBoundaries — single package', () => {
  function makeSinglePackageGraph(overrides?: Partial<ImportGraph>): ImportGraph {
    const nodes: ImportGraphNode[] = [
      node('/project/src/components/Button.tsx', 'src/components/Button.tsx'),
      node('/project/src/pages/Home.tsx', 'src/pages/Home.tsx'),
      node('/project/src/utils/format.ts', 'src/utils/format.ts'),
    ];

    // pages→components, pages→utils, components→utils (but components never→pages, utils never→components)
    const edges: ImportEdge[] = [
      edge('/project/src/pages/Home.tsx', '/project/src/components/Button.tsx'),
      edge('/project/src/pages/Home.tsx', '/project/src/utils/format.ts'),
      edge('/project/src/components/Button.tsx', '/project/src/utils/format.ts'),
    ];

    return { nodes, edges, packages: [], cycles: [], ...overrides };
  }

  it('infers that components should not import from pages', () => {
    const rules = inferBoundaries(makeSinglePackageGraph());

    const compToPages = rules.find((r) => r.from === 'components' && r.to === 'pages');
    expect(compToPages).toEqual({
      from: 'components',
      to: 'pages',
      allow: false,
      reason: 'components should not depend on pages',
    });
  });

  it('infers that utils should not import from components or pages', () => {
    const rules = inferBoundaries(makeSinglePackageGraph());

    const utilsToComp = rules.find((r) => r.from === 'utils' && r.to === 'components');
    const utilsToPages = rules.find((r) => r.from === 'utils' && r.to === 'pages');
    expect(utilsToComp?.allow).toBe(false);
    expect(utilsToPages?.allow).toBe(false);
  });

  it('does not create disallow rules for utils as target when everything imports it', () => {
    const rules = inferBoundaries(makeSinglePackageGraph());

    // pages→utils and components→utils both exist, so no disallow rules should target utils FROM those dirs
    const pagesToUtils = rules.find((r) => r.from === 'pages' && r.to === 'utils');
    const compToUtils = rules.find((r) => r.from === 'components' && r.to === 'utils');
    expect(pagesToUtils).toBeUndefined();
    expect(compToUtils).toBeUndefined();
  });

  it('returns empty array for single-directory project', () => {
    const nodes: ImportGraphNode[] = [
      node('/project/src/a.ts', 'src/a.ts'),
      node('/project/src/b.ts', 'src/b.ts'),
    ];
    const edges: ImportEdge[] = [edge('/project/src/a.ts', '/project/src/b.ts')];

    const graph: ImportGraph = { nodes, edges, packages: [], cycles: [] };
    const rules = inferBoundaries(graph);
    expect(rules).toEqual([]);
  });

  it('returns empty array for empty project', () => {
    const graph: ImportGraph = { nodes: [], edges: [], packages: [], cycles: [] };
    const rules = inferBoundaries(graph);
    expect(rules).toEqual([]);
  });

  it('handles files without src/ prefix', () => {
    const nodes: ImportGraphNode[] = [
      node('/project/components/Button.tsx', 'components/Button.tsx'),
      node('/project/pages/Home.tsx', 'pages/Home.tsx'),
    ];

    // pages imports components but not vice versa
    const edges: ImportEdge[] = [edge('/project/pages/Home.tsx', '/project/components/Button.tsx')];

    const graph: ImportGraph = { nodes, edges, packages: [], cycles: [] };
    const rules = inferBoundaries(graph);

    const compToPages = rules.find((r) => r.from === 'components' && r.to === 'pages');
    expect(compToPages?.allow).toBe(false);
  });
});
