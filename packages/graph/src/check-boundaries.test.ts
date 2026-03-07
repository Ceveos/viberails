import { join } from 'node:path';
import type {
  BoundaryRule,
  ImportEdge,
  ImportGraph,
  ImportGraphNode,
  WorkspacePackage,
} from '@viberails/types';
import { describe, expect, it } from 'vitest';
import { buildImportGraph } from './build-graph.js';
import { checkBoundaries } from './check-boundaries.js';

/** Helper to create a minimal node. */
function node(filePath: string, relativePath: string, packageName?: string): ImportGraphNode {
  return { filePath, relativePath, packageName };
}

/** Helper to create a minimal edge. */
function edge(source: string, target: string, specifier = '', line = 1): ImportEdge {
  return { source, target, specifier, typeOnly: false, dynamic: false, line };
}

describe('checkBoundaries', () => {
  it('returns no violations when there are no rules', () => {
    const graph: ImportGraph = {
      nodes: [node('/a/src/x.ts', 'src/x.ts', 'a')],
      edges: [edge('/a/src/x.ts', '/b/src/y.ts', 'b')],
      packages: [],
      cycles: [],
    };
    expect(checkBoundaries(graph, [])).toEqual([]);
  });

  it('detects a violation for a disallowed import', () => {
    const graph: ImportGraph = {
      nodes: [
        node('/repo/packages/web/src/app.tsx', 'src/app.tsx', '@mono/web'),
        node('/repo/packages/api/src/handler.ts', 'src/handler.ts', '@mono/api'),
      ],
      edges: [
        edge('/repo/packages/web/src/app.tsx', '/repo/packages/api/src/handler.ts', '@mono/api', 5),
      ],
      packages: [
        {
          name: '@mono/web',
          path: '/repo/packages/web',
          relativePath: 'packages/web',
          internalDeps: [],
        },
        {
          name: '@mono/api',
          path: '/repo/packages/api',
          relativePath: 'packages/api',
          internalDeps: [],
        },
      ],
      cycles: [],
    };

    const rules: BoundaryRule[] = [
      { from: '@mono/web', to: '@mono/api', allow: false, reason: 'web should not import api' },
    ];
    const violations = checkBoundaries(graph, rules);

    expect(violations).toHaveLength(1);
    expect(violations[0]).toEqual({
      file: '/repo/packages/web/src/app.tsx',
      line: 5,
      specifier: '@mono/api',
      resolvedTo: '/repo/packages/api/src/handler.ts',
      rule: rules[0],
    });
  });

  it('does not flag edges matching an allow rule', () => {
    const graph: ImportGraph = {
      nodes: [
        node('/repo/packages/web/src/app.tsx', 'src/app.tsx', '@mono/web'),
        node('/repo/packages/core/src/index.ts', 'src/index.ts', '@mono/core'),
      ],
      edges: [
        edge('/repo/packages/web/src/app.tsx', '/repo/packages/core/src/index.ts', '@mono/core'),
      ],
      packages: [
        {
          name: '@mono/web',
          path: '/repo/packages/web',
          relativePath: 'packages/web',
          internalDeps: ['@mono/core'],
        },
        {
          name: '@mono/core',
          path: '/repo/packages/core',
          relativePath: 'packages/core',
          internalDeps: [],
        },
      ],
      cycles: [],
    };

    const rules: BoundaryRule[] = [{ from: '@mono/web', to: '@mono/core', allow: true }];
    expect(checkBoundaries(graph, rules)).toEqual([]);
  });

  it('does not flag same-package edges', () => {
    const graph: ImportGraph = {
      nodes: [
        node('/repo/packages/web/src/app.tsx', 'src/app.tsx', '@mono/web'),
        node('/repo/packages/web/src/utils.ts', 'src/utils.ts', '@mono/web'),
      ],
      edges: [edge('/repo/packages/web/src/app.tsx', '/repo/packages/web/src/utils.ts', './utils')],
      packages: [
        {
          name: '@mono/web',
          path: '/repo/packages/web',
          relativePath: 'packages/web',
          internalDeps: [],
        },
      ],
      cycles: [],
    };

    // Even with a blanket deny rule, same-package edges are never flagged
    const rules: BoundaryRule[] = [{ from: '@mono/web', to: '@mono/web', allow: false }];
    expect(checkBoundaries(graph, rules)).toEqual([]);
  });

  it('skips external/builtin edges', () => {
    const graph: ImportGraph = {
      nodes: [node('/repo/packages/web/src/app.tsx', 'src/app.tsx', '@mono/web')],
      edges: [
        edge('/repo/packages/web/src/app.tsx', 'react', 'react'),
        edge('/repo/packages/web/src/app.tsx', 'node:fs', 'node:fs'),
      ],
      packages: [
        {
          name: '@mono/web',
          path: '/repo/packages/web',
          relativePath: 'packages/web',
          internalDeps: [],
        },
      ],
      cycles: [],
    };

    const rules: BoundaryRule[] = [{ from: '@mono/web', to: 'react', allow: false }];
    expect(checkBoundaries(graph, rules)).toEqual([]);
  });

  it('detects multiple violations from different rules', () => {
    const graph: ImportGraph = {
      nodes: [
        node('/repo/packages/ui/src/bad.tsx', 'src/bad.tsx', '@mv/ui'),
        node('/repo/packages/api/src/bad.ts', 'src/bad.ts', '@mv/api'),
        node('/repo/packages/api/src/handler.ts', 'src/handler.ts', '@mv/api'),
        node('/repo/packages/ui/src/button.tsx', 'src/button.tsx', '@mv/ui'),
      ],
      edges: [
        edge('/repo/packages/ui/src/bad.tsx', '/repo/packages/api/src/handler.ts', '@mv/api', 3),
        edge('/repo/packages/api/src/bad.ts', '/repo/packages/ui/src/button.tsx', '@mv/ui', 2),
      ],
      packages: [
        {
          name: '@mv/ui',
          path: '/repo/packages/ui',
          relativePath: 'packages/ui',
          internalDeps: [],
        },
        {
          name: '@mv/api',
          path: '/repo/packages/api',
          relativePath: 'packages/api',
          internalDeps: [],
        },
      ],
      cycles: [],
    };

    const rules: BoundaryRule[] = [
      { from: '@mv/ui', to: '@mv/api', allow: false, reason: 'UI should not import API' },
      { from: '@mv/api', to: '@mv/ui', allow: false, reason: 'API should not import UI' },
    ];

    const violations = checkBoundaries(graph, rules);
    expect(violations).toHaveLength(2);
    expect(violations[0].file).toContain('ui/src/bad.tsx');
    expect(violations[1].file).toContain('api/src/bad.ts');
  });

  it('works with single-package directory-level rules', () => {
    const graph: ImportGraph = {
      nodes: [
        node('/project/src/components/Button.tsx', 'src/components/Button.tsx'),
        node('/project/src/pages/Home.tsx', 'src/pages/Home.tsx'),
      ],
      edges: [
        edge(
          '/project/src/components/Button.tsx',
          '/project/src/pages/Home.tsx',
          '../pages/Home',
          5,
        ),
      ],
      packages: [],
      cycles: [],
    };

    const rules: BoundaryRule[] = [
      {
        from: 'components',
        to: 'pages',
        allow: false,
        reason: 'Components should not import pages',
      },
    ];

    const violations = checkBoundaries(graph, rules);
    expect(violations).toHaveLength(1);
    expect(violations[0].line).toBe(5);
  });
});

describe('checkBoundaries — fixture-based', () => {
  const FIXTURES = join(import.meta.dirname, '../../..', 'tests/fixtures');

  it('finds 0 violations on monorepo-basic with inferred rules', async () => {
    const MONOREPO = join(FIXTURES, 'monorepo-basic');
    const packages: WorkspacePackage[] = [
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

    const { inferBoundaries } = await import('./infer-boundaries.js');
    const graph = await buildImportGraph(MONOREPO, { packages });
    const rules = inferBoundaries(graph);
    const violations = checkBoundaries(graph, rules);

    expect(violations).toEqual([]);
  });

  it('finds exactly 2 violations on monorepo-violations fixture', async () => {
    const VIOLATIONS = join(FIXTURES, 'monorepo-violations');
    const packages: WorkspacePackage[] = [
      {
        name: '@mv/shared',
        path: join(VIOLATIONS, 'packages/shared'),
        relativePath: 'packages/shared',
        internalDeps: [],
      },
      {
        name: '@mv/ui',
        path: join(VIOLATIONS, 'packages/ui'),
        relativePath: 'packages/ui',
        internalDeps: ['@mv/shared'],
      },
      {
        name: '@mv/api',
        path: join(VIOLATIONS, 'packages/api'),
        relativePath: 'packages/api',
        internalDeps: ['@mv/shared'],
      },
    ];

    const graph = await buildImportGraph(VIOLATIONS, { packages });

    const rules: BoundaryRule[] = [
      { from: '@mv/ui', to: '@mv/api', allow: false, reason: 'UI should not import API' },
      { from: '@mv/api', to: '@mv/ui', allow: false, reason: 'API should not import UI' },
    ];

    const violations = checkBoundaries(graph, rules);
    expect(violations).toHaveLength(2);

    const uiViolation = violations.find((v) => v.file.includes('ui/'));
    const apiViolation = violations.find((v) => v.file.includes('api/'));
    expect(uiViolation?.specifier).toBe('@mv/api');
    expect(apiViolation?.specifier).toBe('@mv/ui');
  });
});
