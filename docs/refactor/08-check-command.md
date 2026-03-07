# Phase 8: Per-Package Rule Resolution in Check Command

## Goal

When checking a file, determine which workspace package it belongs to and apply that package's rule overrides (if any). A file in `apps/mobile/` should be checked against mobile's PascalCase convention, not the global kebab-case.

## Prerequisites

Phase 5 (config with per-package overrides) must be complete.

## File to Modify

### `packages/cli/src/commands/check.ts`

**Current behavior:** Every file is checked against `config.rules` and `config.conventions` directly (the global config).

**New behavior:** Before checking each file, resolve the effective config by merging the global config with any matching package overrides.

**New helper function:**

```typescript
interface ResolvedConfig {
  rules: ConfigRules;
  conventions: ConfigConventions;
}

/**
 * Resolve the effective config for a file by finding its package override.
 * Returns the global config merged with any matching package overrides.
 */
function resolveConfigForFile(
  relPath: string,
  config: ViberailsConfig,
): ResolvedConfig {
  if (!config.packages || config.packages.length === 0) {
    return { rules: config.rules, conventions: config.conventions };
  }

  // Find the matching package by checking if the file path starts with the package path
  // Sort by path length descending to match the most specific package first
  const sortedPackages = [...config.packages].sort(
    (a, b) => b.path.length - a.path.length,
  );

  for (const pkg of sortedPackages) {
    if (relPath.startsWith(`${pkg.path}/`) || relPath === pkg.path) {
      // Merge: global config as base, package overrides on top
      return {
        rules: { ...config.rules, ...pkg.rules },
        conventions: mergeConventionOverrides(config.conventions, pkg.conventions),
      };
    }
  }

  // No matching package — use global config
  return { rules: config.rules, conventions: config.conventions };
}
```

**Convention merge helper:**

```typescript
function mergeConventionOverrides(
  global: ConfigConventions,
  overrides?: Partial<ConfigConventions>,
): ConfigConventions {
  if (!overrides) return global;
  return { ...global, ...overrides };
}
```

**Integration into the check loop:**

```typescript
// In checkCommand(), change:
for (const file of filesToCheck) {
  // ...
  const resolved = resolveConfigForFile(relPath, config);

  // Check 1: File size — use resolved.rules
  if (resolved.rules.maxFileLines > 0) {
    // ...
  }

  // Check 2: File naming — use resolved.conventions
  if (resolved.rules.enforceNaming && resolved.conventions.fileNaming) {
    const namingViolation = checkNamingWithConventions(relPath, resolved.conventions);
    // ...
  }
}
```

**Modify `checkNaming` to accept conventions:**

Currently `checkNaming(relPath, config)` reads `config.conventions.fileNaming` directly. Change to accept conventions as a parameter:

```typescript
function checkNaming(
  relPath: string,
  conventions: ConfigConventions,
): string | undefined {
  // ... same logic but use `conventions.fileNaming` instead of `config.conventions.fileNaming`
}
```

**Missing tests check also needs resolving:**

The `checkMissingTests` function checks `config.structure.testPattern` and `config.structure.srcDir`. For monorepos, this is trickier — each package might have different test patterns. For now, keep using the global config for test checking. Per-package test patterns can be added later.

## Ignore pattern handling

When a package override has `ignore` patterns, append them to the global ignore for files in that package:

```typescript
function resolveIgnoreForFile(
  relPath: string,
  config: ViberailsConfig,
): string[] {
  const globalIgnore = config.ignore;
  if (!config.packages) return globalIgnore;

  for (const pkg of config.packages) {
    if (pkg.ignore && relPath.startsWith(`${pkg.path}/`)) {
      return [...globalIgnore, ...pkg.ignore];
    }
  }
  return globalIgnore;
}
```

## New Tests

### In `packages/cli/src/commands/check.ts` (or a separate test file)

The check command currently doesn't have dedicated tests (it's tested via integration tests). Consider adding unit tests for `resolveConfigForFile`:

```typescript
describe('resolveConfigForFile', () => {
  const config: ViberailsConfig = {
    // ... base config with kebab-case ...
    packages: [{
      name: '@app/mobile',
      path: 'apps/mobile',
      conventions: { fileNaming: 'PascalCase' },
    }],
  };

  it('returns global config for files outside any package', () => {
    const resolved = resolveConfigForFile('src/utils.ts', config);
    expect(getConventionValue(resolved.conventions.fileNaming)).toBe('kebab-case');
  });

  it('returns package override for files inside a package', () => {
    const resolved = resolveConfigForFile('apps/mobile/UserProfile.tsx', config);
    expect(getConventionValue(resolved.conventions.fileNaming)).toBe('PascalCase');
  });

  it('returns global config when no packages configured', () => {
    const noPackages = { ...config, packages: undefined };
    const resolved = resolveConfigForFile('apps/mobile/UserProfile.tsx', noPackages);
    expect(getConventionValue(resolved.conventions.fileNaming)).toBe('kebab-case');
  });
});
```

## Integration Test Idea

Create a temp directory with:
- `apps/web/kebab-file.ts` (should pass with global kebab-case)
- `apps/mobile/PascalFile.tsx` (should pass with mobile's PascalCase override)
- `apps/mobile/kebab-file.ts` (should FAIL with mobile's PascalCase override)

Run `checkCommand` and verify correct violations.

## Verification

```bash
pnpm --filter viberails test  # cli tests pass
pnpm test                     # full suite
```

## Future Considerations

- Per-package test pattern checking (different packages might use `.spec.ts` vs `.test.ts`)
- Per-package boundary rules (boundaries between subfolders within a package)
- Per-package max file lines (API routes might allow longer files)
