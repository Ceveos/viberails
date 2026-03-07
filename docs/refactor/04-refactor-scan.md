# Phase 4: Refactor `scan()` Orchestrator

## Goal

Rewire `scan()` to use `scanPackage()` + aggregation. Remove the old monorepo hacks (`detectAdditionalFrameworks`, `workspaceDirs`). This is where everything comes together.

## Prerequisites

Phases 1-3 must be complete.

## Files to Modify

### 1. `packages/scanner/src/scan.ts`

**Current flow:**
```
walkDirectory(root, 4) → all dirs
detectWorkspace(root)
detectStack(root, workspaceDirs) → single stack with merged deps
detectStructure(root, dirs) → single structure from all dirs
computeStatistics(root, dirs) → single stats from all dirs
detectConventions(root, structure, dirs) → single conventions from all dirs
```

**New flow:**
```
detectWorkspace(root)

if workspace:
  readPackageJson(root) → rootDeps
  for each workspace package (parallel):
    scanPackage(pkgPath, pkgName, relativePath, rootDeps)
  aggregateStacks(packages) → global stack
  aggregateStructures(packages) → global structure
  aggregateConventions(packages) → global conventions
  aggregateStatistics(packages) → global stats

if no workspace:
  scanPackage(root, name, "") → single PackageScanResult
  global fields = copy of that result's fields

return ScanResult { root, stack, structure, conventions, statistics, workspace, packages }
```

**Key changes:**
- Remove the root-level `walkDirectory` call — each package walks its own tree
- Remove `filterFixtureDirs` from here — move it into `scanPackage` (each package filters its own fixtures)
- Import `scanPackage` from `./scan-package.js`
- Import aggregation functions from `./aggregate.js`
- Import `readPackageJson` from `./utils/read-package-json.js`
- For single-package: read root package.json name, default to `path.basename(root)`

**Implementation sketch:**

```typescript
export async function scan(projectPath: string): Promise<ScanResult> {
  const root = resolve(projectPath);
  // ... existing validation ...

  const workspace = await detectWorkspace(root);

  if (workspace && workspace.packages.length > 0) {
    // Read root deps for sharing with workspace packages
    const rootPkg = await readPackageJson(root);
    const rootDeps: Record<string, string> = {
      ...rootPkg?.dependencies,
      ...rootPkg?.devDependencies,
    };

    // Scan each workspace package in parallel
    const packages = await Promise.all(
      workspace.packages.map(wp =>
        scanPackage(wp.path, wp.name, wp.relativePath, rootDeps)
      )
    );

    // Aggregate into global fields
    return {
      root,
      stack: aggregateStacks(packages),
      structure: aggregateStructures(packages),
      conventions: aggregateConventions(packages),
      statistics: aggregateStatistics(packages),
      workspace,
      packages,
    };
  }

  // Single-package project
  const rootPkg = await readPackageJson(root);
  const name = rootPkg?.name ?? path.basename(root);
  const pkg = await scanPackage(root, name, '');

  return {
    root,
    stack: pkg.stack,
    structure: pkg.structure,
    conventions: pkg.conventions,
    statistics: pkg.statistics,
    packages: [pkg],
  };
}
```

### 2. `packages/scanner/src/detect-stack.ts`

**Changes from Phase 2** (may already be done):
- Change `workspaceDirs?: string[]` to `additionalDeps?: Record<string, string>`
- Remove `detectAdditionalFrameworks()` function entirely
- Remove workspace package reading loop from `detectStack()`
- Change dep merging to: `{ ...additionalDeps, ...pkg?.dependencies, ...pkg?.devDependencies }`
- Remove `workspaceDirs` from `detectLanguage()` — TypeScript detection now works via merged deps
- Simplify `detectLanguage` back to checking `allDeps` and `tsconfig.json` at the given path only

### 3. `packages/scanner/src/index.ts`

Add exports:
```typescript
export { scanPackage } from './scan-package.js';
export type { /* if any */ } from './scan-package.js';
export {
  aggregateStacks,
  aggregateStructures,
  aggregateConventions,
  aggregateStatistics,
} from './aggregate.js';
```

## Updating Existing Tests

### `packages/scanner/src/detect-stack.test.ts`

- Update tests that used `workspaceDirs` parameter — they should use `additionalDeps` instead
- The "workspace dependency aggregation" tests should pass the root deps as a flat record
- Remove any tests for `detectAdditionalFrameworks`

### `packages/scanner/src/scan.test.ts`

- Update existing tests to verify `packages` field is populated
- The `monorepo-nextjs-expo` fixture tests should verify:
  - `result.packages.length === 3` (web, mobile, shared)
  - Each package has correct individual framework
  - Aggregate `result.stack.framework` is the primary
  - Aggregate `result.structure.directories` has prefixed paths
- Single-package fixture tests should verify:
  - `result.packages.length === 1`
  - `result.packages[0].stack` matches `result.stack`

## Verification

```bash
pnpm --filter @viberails/scanner test  # all tests pass
pnpm test                              # full suite passes (downstream consumers use aggregate fields)
```

## Key Risk: Backward Compatibility

The top-level `stack`, `structure`, `conventions`, `statistics` fields must produce equivalent output to what the old code produced. The aggregation functions handle this, but verify:
- `nextjs-15` fixture: `scan()` output should match the existing snapshot (update if directory path format changes)
- `monorepo-basic` fixture: should still work
- `empty` and `no-package-json` fixtures: should still work
