import type { WorkspacePackage } from '@viberails/types';
import { Project } from 'ts-morph';
import { describe, expect, it } from 'vitest';
import { resolveImport } from './resolve-import.js';

function createProject(files: Record<string, string>) {
  const project = new Project({ useInMemoryFileSystem: true });
  for (const [path, content] of Object.entries(files)) {
    project.createSourceFile(path, content);
  }
  return project;
}

const PACKAGES: WorkspacePackage[] = [
  {
    name: '@mono/core',
    path: '/project/packages/core',
    relativePath: 'packages/core',
    internalDeps: [],
  },
];

describe('resolveImport', () => {
  it('classifies relative imports as internal', () => {
    const project = createProject({
      '/project/src/foo.ts': '',
      '/project/src/bar.ts': '',
    });
    const result = resolveImport('./bar', '/project/src/foo.ts', project, []);

    expect(result.kind).toBe('internal');
    expect(result.resolvedPath).toBe('/project/src/bar.ts');
  });

  it('classifies node:fs as builtin', () => {
    const project = createProject({ '/project/src/foo.ts': '' });
    const result = resolveImport('node:fs', '/project/src/foo.ts', project, []);

    expect(result.kind).toBe('builtin');
  });

  it('classifies bare fs as builtin', () => {
    const project = createProject({ '/project/src/foo.ts': '' });
    const result = resolveImport('fs', '/project/src/foo.ts', project, []);

    expect(result.kind).toBe('builtin');
  });

  it('classifies workspace package as workspace', () => {
    const project = createProject({ '/project/src/foo.ts': '' });
    const result = resolveImport('@mono/core', '/project/src/foo.ts', project, PACKAGES);

    expect(result.kind).toBe('workspace');
    expect(result.packageName).toBe('@mono/core');
    expect(result.resolvedPath).toBe('/project/packages/core');
  });

  it('classifies workspace subpath imports as workspace', () => {
    const project = createProject({ '/project/src/foo.ts': '' });
    const result = resolveImport('@mono/core/utils', '/project/src/foo.ts', project, PACKAGES);

    expect(result.kind).toBe('workspace');
    expect(result.packageName).toBe('@mono/core');
  });

  it('classifies external packages as external', () => {
    const project = createProject({ '/project/src/foo.ts': '' });
    const result = resolveImport('react', '/project/src/foo.ts', project, []);

    expect(result.kind).toBe('external');
    expect(result.packageName).toBe('react');
  });

  it('classifies unresolvable relative imports as unresolved', () => {
    const project = createProject({ '/project/src/foo.ts': '' });
    const result = resolveImport('./nonexistent', '/project/src/foo.ts', project, []);

    expect(result.kind).toBe('unresolved');
  });

  it('resolves relative import with .ts extension', () => {
    const project = createProject({
      '/project/src/index.ts': '',
      '/project/src/utils.ts': '',
    });
    const result = resolveImport('./utils', '/project/src/index.ts', project, []);

    expect(result.kind).toBe('internal');
    expect(result.resolvedPath).toBe('/project/src/utils.ts');
  });
});
