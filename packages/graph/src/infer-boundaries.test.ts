import type { ImportEdge, ImportGraph, ImportGraphNode, WorkspacePackage } from '@viberails/types';
import { describe, expect, it } from 'vitest';
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
    const result = inferBoundaries(makeMonorepoGraph());

    expect(result.deny['@mono/api']).toContain('@mono/web');
    expect(result.deny['@mono/web']).toContain('@mono/api');
  });

  it('does not deny declared dependencies with actual imports', () => {
    const result = inferBoundaries(makeMonorepoGraph());

    // api→core and web→core are declared deps with imports — should NOT be in deny
    expect(result.deny['@mono/api'] ?? []).not.toContain('@mono/core');
    expect(result.deny['@mono/web'] ?? []).not.toContain('@mono/core');
  });

  it('denies core importing from api or web', () => {
    const result = inferBoundaries(makeMonorepoGraph());

    expect(result.deny['@mono/core']).toContain('@mono/api');
    expect(result.deny['@mono/core']).toContain('@mono/web');
  });

  it('does not deny when all packages import from shared', () => {
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
    const result = inferBoundaries(graph);

    // shared→app should be denied (no imports, not a dep)
    expect(result.deny['@mono/shared']).toContain('@mono/app');

    // app→shared should NOT be denied (imports exist, declared dep)
    expect(result.deny['@mono/app'] ?? []).not.toContain('@mono/shared');
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
    const result = inferBoundaries(graph);

    // Should NOT deny a→b (would immediately violate)
    expect(result.deny['@mono/a'] ?? []).not.toContain('@mono/b');
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
    const result = inferBoundaries(graph);

    // app→types should NOT be denied (type-only import counts as real)
    expect(result.deny['@mono/app'] ?? []).not.toContain('@mono/types');
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
    const result = inferBoundaries(makeSinglePackageGraph());

    expect(result.deny.components).toContain('pages');
  });

  it('infers that utils should not import from components or pages', () => {
    const result = inferBoundaries(makeSinglePackageGraph());

    expect(result.deny.utils).toContain('components');
    expect(result.deny.utils).toContain('pages');
  });

  it('does not deny imports that already exist', () => {
    const result = inferBoundaries(makeSinglePackageGraph());

    // pages→utils and components→utils both exist, so no deny rules for those
    expect(result.deny.pages ?? []).not.toContain('utils');
    expect(result.deny.components ?? []).not.toContain('utils');
  });

  it('returns empty deny map for single-directory project', () => {
    const nodes: ImportGraphNode[] = [
      node('/project/src/a.ts', 'src/a.ts'),
      node('/project/src/b.ts', 'src/b.ts'),
    ];
    const edges: ImportEdge[] = [edge('/project/src/a.ts', '/project/src/b.ts')];

    const graph: ImportGraph = { nodes, edges, packages: [], cycles: [] };
    const result = inferBoundaries(graph);
    expect(result.deny).toEqual({});
  });

  it('returns empty deny map for empty project', () => {
    const graph: ImportGraph = { nodes: [], edges: [], packages: [], cycles: [] };
    const result = inferBoundaries(graph);
    expect(result.deny).toEqual({});
  });

  it('handles files without src/ prefix', () => {
    const nodes: ImportGraphNode[] = [
      node('/project/components/Button.tsx', 'components/Button.tsx'),
      node('/project/pages/Home.tsx', 'pages/Home.tsx'),
    ];

    // pages imports components but not vice versa
    const edges: ImportEdge[] = [edge('/project/pages/Home.tsx', '/project/components/Button.tsx')];

    const graph: ImportGraph = { nodes, edges, packages: [], cycles: [] };
    const result = inferBoundaries(graph);

    expect(result.deny.components).toContain('pages');
  });
});
