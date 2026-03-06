import { describe, expect, it } from 'vitest';
import { Project } from 'ts-morph';
import { parseImports } from './parse-imports.js';

function createSourceFile(content: string) {
  const project = new Project({ useInMemoryFileSystem: true });
  return project.createSourceFile('test.ts', content);
}

describe('parseImports', () => {
  it('parses a static import with correct specifier and line', () => {
    const sf = createSourceFile("import { foo } from './bar';");
    const edges = parseImports(sf);

    expect(edges).toHaveLength(1);
    expect(edges[0].specifier).toBe('./bar');
    expect(edges[0].line).toBe(1);
    expect(edges[0].typeOnly).toBe(false);
    expect(edges[0].dynamic).toBe(false);
  });

  it('detects type-only imports', () => {
    const sf = createSourceFile("import type { Foo } from './types';");
    const edges = parseImports(sf);

    expect(edges).toHaveLength(1);
    expect(edges[0].typeOnly).toBe(true);
    expect(edges[0].specifier).toBe('./types');
  });

  it('detects dynamic imports', () => {
    const sf = createSourceFile("const m = await import('./lazy');");
    const edges = parseImports(sf);

    expect(edges).toHaveLength(1);
    expect(edges[0].dynamic).toBe(true);
    expect(edges[0].specifier).toBe('./lazy');
  });

  it('parses re-exports', () => {
    const sf = createSourceFile("export { foo } from './utils';");
    const edges = parseImports(sf);

    expect(edges).toHaveLength(1);
    expect(edges[0].specifier).toBe('./utils');
  });

  it('parses export-all re-exports', () => {
    const sf = createSourceFile("export * from './all';");
    const edges = parseImports(sf);

    expect(edges).toHaveLength(1);
    expect(edges[0].specifier).toBe('./all');
  });

  it('skips CSS imports', () => {
    const sf = createSourceFile("import './styles.css';");
    const edges = parseImports(sf);
    expect(edges).toHaveLength(0);
  });

  it('skips SCSS and other asset imports', () => {
    const sf = createSourceFile(
      [
        "import './styles.scss';",
        "import logo from './logo.png';",
        "import data from './data.json';",
      ].join('\n'),
    );
    const edges = parseImports(sf);
    expect(edges).toHaveLength(0);
  });

  it('captures side-effect imports', () => {
    const sf = createSourceFile("import './polyfill';");
    const edges = parseImports(sf);

    expect(edges).toHaveLength(1);
    expect(edges[0].specifier).toBe('./polyfill');
  });

  it('handles multiple imports from same module', () => {
    const sf = createSourceFile(
      ["import { a } from './mod';", "import { b } from './mod';"].join('\n'),
    );
    const edges = parseImports(sf);
    expect(edges).toHaveLength(2);
  });

  it('parses default imports', () => {
    const sf = createSourceFile("import React from 'react';");
    const edges = parseImports(sf);

    expect(edges).toHaveLength(1);
    expect(edges[0].specifier).toBe('react');
  });

  it('parses namespace imports', () => {
    const sf = createSourceFile("import * as path from 'node:path';");
    const edges = parseImports(sf);

    expect(edges).toHaveLength(1);
    expect(edges[0].specifier).toBe('node:path');
  });
});
