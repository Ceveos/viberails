# Phase 3: Create Aggregation Functions

## Goal

Create functions that combine multiple `PackageScanResult`s into the aggregate top-level fields of `ScanResult`. These produce the backward-compatible global view.

## Prerequisites

Phase 1 (types) and Phase 2 (scanPackage) must be complete.

## File to Create

### `packages/scanner/src/aggregate.ts`

Four pure functions, no side effects, easy to test:

```typescript
import type {
  CodebaseStatistics,
  DetectedConvention,
  DetectedStack,
  DetectedStructure,
  PackageScanResult,
} from '@viberails/types';
```

#### `aggregateStacks(packages: PackageScanResult[]): DetectedStack`

Combines per-package stacks into a global stack:

- **language**: Use the most common language. If any package uses TypeScript, the aggregate is TypeScript (TS is a superset of JS).
- **packageManager**: Take from the first package (they share the workspace root's lock file).
- **framework**: Take the first package's framework that has one (for `framework` back-compat field). This is a reasonable "primary framework."
- **libraries**: Collect ALL unique frameworks from all packages (deduplicated by name), plus all unique libraries from all packages. This replaces the old `detectAdditionalFrameworks` hack cleanly — every package's framework that isn't the primary one ends up here.
- **styling, backend, linter, testRunner**: Take the first non-undefined value found across packages.

Example: For a monorepo with Next.js (web) + Expo (mobile):
```
framework: { name: 'nextjs', version: '15' }  // first found
libraries: [{ name: 'expo', version: '53' }, { name: 'zod', version: '3' }]
language: { name: 'typescript', version: '5' }
```

#### `aggregateStructures(packages: PackageScanResult[]): DetectedStructure`

Combines per-package structures:

- **srcDir**: Set to `'src'` if ANY package uses a src directory.
- **directories**: For each package, prefix every directory's `path` with the package's `relativePath`. So `components` in `apps/web` becomes `apps/web/components`. Merge all into one flat list. For single-package projects (relativePath = `""`), paths are unchanged.
- **testPattern**: Take the most common test pattern across packages, or the first one found.

#### `aggregateConventions(packages: PackageScanResult[]): Record<string, DetectedConvention>`

This is the most important aggregation — it solves the "mixed conventions" problem:

For each convention key (`fileNaming`, `componentNaming`, `hookNaming`, `importAlias`):
1. Collect the detected value from each package that has it
2. If ALL packages agree (same value) → report at the aggregate level with consistency = average of per-package consistencies
3. If packages disagree → report the majority value, but LOWER the confidence:
   - Compute `agreement = (packages with majority value) / (total packages with this convention)`
   - Scale the consistency: `aggregateConsistency = majorityConsistency * agreement`
   - This naturally produces medium/low confidence for mixed conventions
4. If fewer than half of packages have a convention → omit from aggregate (not enough data)

Example: 3 packages, 2 use kebab-case (95% each), 1 uses PascalCase (100%):
```
aggregate fileNaming = kebab-case, consistency = 95 * (2/3) = 63% → low confidence → omitted
```
Each package's own convention is preserved at 95% and 100% in their `PackageScanResult`. The aggregate correctly says "no dominant convention." The per-package config overrides (Phase 5) will capture the differences.

#### `aggregateStatistics(packages: PackageScanResult[]): CodebaseStatistics`

- **totalFiles**: Sum across packages
- **totalLines**: Sum across packages
- **averageFileLines**: `totalLines / totalFiles` (recomputed, not averaged)
- **largestFiles**: Merge all packages' largest files, prefix paths with `relativePath/`, sort descending, take top 5
- **filesByExtension**: Sum counts per extension across packages

## File to Create

### `packages/scanner/src/aggregate.test.ts`

Test each function independently with crafted `PackageScanResult` objects:

```typescript
describe('aggregateStacks', () => {
  it('picks TypeScript if any package uses it', () => { ... });
  it('picks first framework as primary', () => { ... });
  it('includes other frameworks in libraries', () => { ... });
  it('deduplicates libraries', () => { ... });
  it('returns single package stack unchanged', () => { ... });
});

describe('aggregateConventions', () => {
  it('reports shared convention at aggregate level when all agree', () => { ... });
  it('lowers confidence when packages disagree', () => { ... });
  it('omits convention when fewer than half of packages have it', () => { ... });
  it('returns single package conventions unchanged', () => { ... });
});

describe('aggregateStructures', () => {
  it('prefixes directory paths with package relativePath', () => { ... });
  it('does not prefix for single-package (empty relativePath)', () => { ... });
  it('merges all directories into flat list', () => { ... });
});

describe('aggregateStatistics', () => {
  it('sums totals across packages', () => { ... });
  it('recomputes average from summed totals', () => { ... });
  it('merges and re-sorts largest files', () => { ... });
});
```

## Verification

```bash
pnpm --filter @viberails/scanner test  # all tests pass
```
