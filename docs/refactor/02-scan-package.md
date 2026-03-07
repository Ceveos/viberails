# Phase 2: Create `scanPackage()`

## Goal

Create the core per-package scanning function. It reuses all existing detector functions but scoped to a single package directory.

## Prerequisites

Phase 1 (types) must be complete.

## Files to Create

### `packages/scanner/src/scan-package.ts`

```typescript
import type { PackageScanResult } from '@viberails/types';
```

**Function signature:**

```typescript
export async function scanPackage(
  packagePath: string,
  name: string,
  relativePath: string,
  rootDeps?: Record<string, string>,
): Promise<PackageScanResult>
```

**Parameters:**
- `packagePath` — absolute path to the package directory
- `name` — package name (from package.json)
- `relativePath` — path relative to workspace root (empty string `""` for single-package projects)
- `rootDeps` — optional merged root-level `dependencies + devDependencies`. In monorepos, shared devDeps like `typescript`, `eslint`, `vitest` are declared at root, not per-package. These are merged as a base before package-specific deps overlay.

**Implementation:**

1. Walk the package directory tree: `walkDirectory(packagePath, 4)`
2. Read this package's `package.json` and merge deps: root deps (base) + package deps (overlay)
3. Call existing detectors scoped to this package:
   - `detectStack(packagePath)` — **but** needs the merged deps, not just the package's own. See "Important Subtlety" below.
   - `detectStructure(packagePath, dirs)`
   - `detectConventions(packagePath, structure, dirs)`
   - `computeStatistics(packagePath, dirs)`
4. Return `PackageScanResult`

**Important Subtlety — Root Deps:**

Currently `detectStack()` reads `package.json` from the given path internally. For `scanPackage`, we need to pass merged deps. Two options:

**Option A (recommended):** Modify `detectStack` to accept an optional `additionalDeps` parameter (instead of the current `workspaceDirs`). When provided, these deps are merged before detection. This way `detectStack` doesn't need to know about workspaces — it just receives extra deps.

```typescript
// In detect-stack.ts, change signature to:
export async function detectStack(
  projectPath: string,
  additionalDeps?: Record<string, string>,
): Promise<DetectedStack>
```

Inside, merge: `{ ...additionalDeps, ...pkg?.dependencies, ...pkg?.devDependencies }` — package-specific deps win over root deps.

**Option B:** Have `scanPackage` read the package.json itself, merge deps, and pass them to a lower-level detection function. This is more surgical but requires more refactoring.

Go with Option A — it's the smallest change.

## Files to Create

### `packages/scanner/src/scan-package.test.ts`

Test `scanPackage` against the `monorepo-nextjs-expo` fixture:

```typescript
// Test scanning apps/web independently
it('detects Next.js stack for web package', async () => {
  const result = await scanPackage(
    join(fixturesDir, 'monorepo-nextjs-expo', 'apps', 'web'),
    '@app/web',
    'apps/web',
  );
  expect(result.stack.framework?.name).toBe('nextjs');
  expect(result.stack.language.name).toBe('typescript');
  expect(result.name).toBe('@app/web');
  expect(result.relativePath).toBe('apps/web');
});

// Test scanning apps/mobile independently
it('detects Expo stack for mobile package', async () => {
  const result = await scanPackage(
    join(fixturesDir, 'monorepo-nextjs-expo', 'apps', 'mobile'),
    '@app/mobile',
    'apps/mobile',
  );
  expect(result.stack.framework?.name).toBe('expo');
});

// Test that rootDeps are merged (typescript declared at root)
it('detects typescript when passed as rootDeps', async () => {
  const result = await scanPackage(
    join(fixturesDir, 'monorepo-nextjs-expo', 'packages', 'shared'),
    '@app/shared',
    'packages/shared',
    { typescript: '^5.7.0' },  // root dep
  );
  expect(result.stack.language.name).toBe('typescript');
});

// Test structure detection is scoped to package
it('detects components directory within web package', async () => {
  const result = await scanPackage(
    join(fixturesDir, 'monorepo-nextjs-expo', 'apps', 'web'),
    '@app/web',
    'apps/web',
  );
  const compDir = result.structure.directories.find(d => d.role === 'components');
  expect(compDir).toBeDefined();
  // Path should be relative to the PACKAGE, not workspace root
  expect(compDir?.path).toBe('components');
});
```

## Existing Functions to Reuse (No Changes Needed)

- `walkDirectory()` from `packages/scanner/src/utils/walk-directory.ts`
- `detectStructure()` from `packages/scanner/src/detect-structure.ts`
- `detectConventions()` from `packages/scanner/src/detect-conventions.ts`
- `computeStatistics()` from `packages/scanner/src/compute-statistics.ts`
- `classifyDirectory()` from `packages/scanner/src/utils/classify-directory.ts`

## Existing Functions That Need Small Changes

- `detectStack()` in `packages/scanner/src/detect-stack.ts`:
  - Change `workspaceDirs?: string[]` parameter to `additionalDeps?: Record<string, string>`
  - Remove `detectAdditionalFrameworks()` entirely
  - In dep merging: `{ ...additionalDeps, ...pkg?.dependencies, ...pkg?.devDependencies }`
  - Remove the workspace package reading loop
  - Remove the `workspaceDirs` from `detectLanguage` — it will get TypeScript from merged deps instead

## Key Design Decision: Directory Paths

When `scanPackage` scans `apps/web/`, the walked directories have paths like `components`, `app/api`, `lib` — relative to the package root, NOT the workspace root. This is correct and important. The aggregation phase (Phase 3) will prefix these with the package's `relativePath` when building the global structure.

## Verification

```bash
pnpm --filter @viberails/scanner test  # new + existing tests pass
```
