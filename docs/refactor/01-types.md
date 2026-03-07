# Phase 1: Type Changes

## Goal

Add `PackageScanResult` and `PackageConfigOverrides` types. Extend `ScanResult` and `ViberailsConfig` with a `packages` field. No behavior changes — just type definitions.

## Files to Modify

### 1. `packages/types/src/scan-result.ts`

Add `PackageScanResult` interface (new type representing a single scanned package):

```typescript
/**
 * Scan results for a single package within a workspace,
 * or the root of a single-package project.
 */
export interface PackageScanResult {
  /** Package name from package.json. */
  name: string;
  /** Absolute path to this package's root directory. */
  root: string;
  /** Path relative to the workspace root. Empty string for single-package projects. */
  relativePath: string;
  /** Detected technology stack for this package. */
  stack: DetectedStack;
  /** Detected directory structure within this package. */
  structure: DetectedStructure;
  /** Detected coding conventions for this package. */
  conventions: Record<string, DetectedConvention>;
  /** Quantitative statistics for this package. */
  statistics: CodebaseStatistics;
}
```

Add `packages` field to existing `ScanResult`:

```typescript
export interface ScanResult {
  // ... all existing fields stay exactly as they are ...

  /**
   * Per-package scan results. Always has at least one entry.
   * For single-package projects, contains one entry identical to the top-level fields.
   * For monorepos, contains one entry per workspace package.
   */
  packages: PackageScanResult[];
}
```

### 2. `packages/types/src/config.ts`

Add `PackageConfigOverrides` interface:

```typescript
/**
 * Per-package configuration overrides for monorepo projects.
 * Only fields that differ from the global config are included.
 */
export interface PackageConfigOverrides {
  /** Package name from package.json. */
  name: string;
  /** Relative path to the package (e.g. "apps/web"). */
  path: string;
  /** Override stack fields (only differences from global). */
  stack?: Partial<ConfigStack>;
  /** Override conventions (only differences from global). */
  conventions?: Partial<ConfigConventions>;
  /** Override rules (only differences from global). */
  rules?: Partial<ConfigRules>;
  /** Additional ignore patterns for this package (appended to global). */
  ignore?: string[];
}
```

Add `packages` field to existing `ViberailsConfig`:

```typescript
export interface ViberailsConfig {
  // ... all existing fields stay exactly as they are ...

  /** Per-package overrides for monorepo projects. Only packages that differ from global. */
  packages?: PackageConfigOverrides[];
}
```

### 3. `packages/types/src/index.ts`

Add exports for the new types:

```typescript
export type { PackageScanResult } from './scan-result.js';
export type { PackageConfigOverrides } from './config.js';
```

## Verification

```bash
pnpm --filter @viberails/types build  # types build successfully
pnpm test                             # all tests still pass (no behavior changes)
```

## Notes

- `PackageScanResult` deliberately does NOT include `workspace` — that's a root-level concern only
- `packages` on `ScanResult` is required (not optional) — it always has ≥1 entry
- `packages` on `ViberailsConfig` is optional — omitted for single-package projects and for monorepos where all packages share the same conventions
- No changes to `DetectedStack` — each package gets its own `framework` field naturally
