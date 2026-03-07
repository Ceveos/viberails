# Phase 5: Config Generation with Per-Package Overrides

## Goal

When generating config from a monorepo scan, produce per-package overrides for packages whose conventions/stack differ from the aggregate. Update the JSON schema to support the new `packages` field.

## Prerequisites

Phases 1-4 must be complete.

## Files to Modify

### 1. `packages/config/src/generate-config.ts`

**Current behavior:** `generateConfig(scanResult)` produces a flat `ViberailsConfig` using only the top-level aggregate fields.

**New behavior:** After generating the global config, compare each package's conventions and stack against the aggregate. For packages that differ, emit `PackageConfigOverrides`.

Add a new function:

```typescript
function generatePackageOverrides(
  scanResult: ScanResult,
  globalConfig: ViberailsConfig,
): PackageConfigOverrides[] | undefined
```

Logic:
1. If `scanResult.packages.length <= 1`, return `undefined` (no overrides needed)
2. For each `PackageScanResult` in `scanResult.packages`:
   a. Compare its `stack.framework` to `globalConfig.stack.framework` — if different, add stack override
   b. Compare its `conventions` to `globalConfig.conventions` — for each key, if the value differs, add convention override
   c. If no differences found, skip this package
3. Return the overrides array, or `undefined` if empty

**Convention comparison helper:**

```typescript
function conventionsDiffer(
  pkgConventions: Record<string, DetectedConvention>,
  globalConventions: ConfigConventions,
): Partial<ConfigConventions> | undefined
```

Compare each convention key. If the package has a convention with a different `value` than the global, include it in the override (mapped through `mapConvention`).

**Integration into `generateConfig`:**

```typescript
export function generateConfig(scanResult: ScanResult): ViberailsConfig {
  // ... existing code builds global config ...

  const packageOverrides = generatePackageOverrides(scanResult, config);
  if (packageOverrides) {
    config.packages = packageOverrides;
  }

  return config;
}
```

### 2. `packages/config/src/merge-config.ts`

Add merging logic for the `packages` field:

```typescript
// In mergeConfig():
// Packages: preserve existing overrides, add new ones
if (existing.packages || fresh.packages) {
  merged.packages = mergePackageOverrides(existing.packages, fresh.packages);
}
```

```typescript
function mergePackageOverrides(
  existing?: PackageConfigOverrides[],
  fresh?: PackageConfigOverrides[],
): PackageConfigOverrides[] | undefined {
  if (!fresh || fresh.length === 0) return existing;
  if (!existing || existing.length === 0) return fresh;

  // Index existing by path for fast lookup
  const existingByPath = new Map(existing.map(p => [p.path, p]));
  const merged: PackageConfigOverrides[] = [...existing];

  for (const freshPkg of fresh) {
    if (!existingByPath.has(freshPkg.path)) {
      merged.push(freshPkg); // new package
    }
    // Existing packages keep their user-edited overrides
  }

  return merged.length > 0 ? merged : undefined;
}
```

### 3. `packages/config/src/schema.ts`

Add the `packages` field to the JSON schema:

```typescript
// Add to properties:
packages: {
  type: 'array',
  items: {
    type: 'object',
    required: ['name', 'path'],
    properties: {
      name: { type: 'string', description: 'Package name from package.json.' },
      path: { type: 'string', description: 'Relative path to the package.' },
      stack: {
        type: 'object',
        properties: {
          framework: { type: 'string' },
          language: { type: 'string' },
          styling: { type: 'string' },
          backend: { type: 'string' },
          packageManager: { type: 'string' },
          linter: { type: 'string' },
          testRunner: { type: 'string' },
        },
        additionalProperties: false,
      },
      conventions: { $ref: '#/properties/conventions' },
      rules: {
        type: 'object',
        properties: {
          maxFileLines: { type: 'number' },
          maxFunctionLines: { type: 'number' },
          requireTests: { type: 'boolean' },
          enforceNaming: { type: 'boolean' },
          enforceBoundaries: { type: 'boolean' },
        },
        additionalProperties: false,
      },
      ignore: { type: 'array', items: { type: 'string' } },
    },
    additionalProperties: false,
  },
  description: 'Per-package overrides for monorepo projects.',
},
```

## New Tests

### `packages/config/src/generate-config.test.ts`

```typescript
describe('per-package overrides', () => {
  it('generates no overrides for single-package project', () => {
    const config = generateConfig(singlePackageScanResult);
    expect(config.packages).toBeUndefined();
  });

  it('generates overrides when package conventions differ', () => {
    // scanResult with packages[0] using kebab-case and packages[1] using PascalCase
    const config = generateConfig(mixedConventionsScanResult);
    expect(config.packages).toBeDefined();
    expect(config.packages?.length).toBeGreaterThan(0);
  });

  it('omits overrides for packages matching global conventions', () => {
    // All packages use kebab-case
    const config = generateConfig(uniformScanResult);
    expect(config.packages).toBeUndefined();
  });

  it('includes framework override when package framework differs from global', () => {
    const config = generateConfig(mixedFrameworkScanResult);
    const mobileOverride = config.packages?.find(p => p.path === 'apps/mobile');
    expect(mobileOverride?.stack?.framework).toBe('expo@53');
  });
});
```

## Example Output

For a monorepo with Next.js (web, kebab-case) + Expo (mobile, PascalCase):

```json
{
  "version": 1,
  "name": "my-app",
  "enforcement": "warn",
  "stack": {
    "language": "typescript@5",
    "framework": "nextjs@15",
    "packageManager": "pnpm"
  },
  "conventions": {
    "fileNaming": { "value": "kebab-case", "_confidence": "high", "_consistency": 95 }
  },
  "rules": { "maxFileLines": 300, "maxFunctionLines": 50, "requireTests": true, "enforceNaming": true, "enforceBoundaries": false },
  "ignore": ["dist/**", "node_modules/**"],
  "workspace": { "packages": ["apps/web", "apps/mobile", "packages/shared"], "isMonorepo": true },
  "packages": [
    {
      "name": "@app/mobile",
      "path": "apps/mobile",
      "stack": { "framework": "expo@53" },
      "conventions": { "fileNaming": { "value": "PascalCase", "_confidence": "high", "_consistency": 100 } }
    }
  ]
}
```

Note: `apps/web` and `packages/shared` are NOT in the overrides because they match the global conventions.

## Verification

```bash
pnpm --filter @viberails/config test  # all tests pass
pnpm test                             # full suite passes
```
