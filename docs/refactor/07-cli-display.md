# Phase 7: CLI Display for Monorepos

## Goal

When scan results contain multiple packages, show per-package summaries with framework and stats instead of a flat list. Single-package output remains identical.

## Prerequisites

Phase 4 (refactored scan) must be complete.

## File to Modify

### `packages/cli/src/display.ts`

**Current behavior:** Shows one "Detected" section with all stack items, one "Structure" section with all directories, one "Conventions" section.

**New behavior for monorepos:**

```
Detected: (monorepo, 3 packages)
  ✓ TypeScript 5
  ✓ pnpm

  apps/web — Next.js 15, Tailwind CSS 4 (6 files)
  apps/mobile — Expo (3 files)
  packages/shared — (2 files)

Structure:
  apps/web:
    ✓ components — Components (3 files)
    ✓ app/api — API routes (1 file)
    ✓ lib — Utilities (2 files)
  apps/mobile:
    ✓ hooks — Hooks (3 files)

Conventions:
  ✓ Hook naming: use-* (100% — high confidence, will enforce)
  ~ File naming: varies by package
    apps/web: kebab-case (95%)
    apps/mobile: PascalCase (100%)
```

**Implementation:**

1. Check `scanResult.packages.length > 1` — if so, use monorepo display
2. For monorepo display:
   - Show shared stack items (language, packageManager, linter, testRunner) at top
   - Show per-package summaries: `{relativePath} — {framework}, {styling} ({totalFiles} files)`
   - Group structure directories by package
   - For conventions: if global convention exists, show it. If packages differ, show per-package breakdown
3. For single-package: use existing display (unchanged)

**New function:**

```typescript
function displayMonorepoResults(scanResult: ScanResult): void
```

**Modify `displayScanResults`:**

```typescript
export function displayScanResults(scanResult: ScanResult): void {
  if (scanResult.packages.length > 1) {
    displayMonorepoResults(scanResult);
    return;
  }
  // ... existing single-package display ...
}
```

**Helper: format package summary line:**

```typescript
function formatPackageSummary(pkg: PackageScanResult): string {
  const parts: string[] = [];
  if (pkg.stack.framework) {
    parts.push(formatItem(pkg.stack.framework, FRAMEWORK_NAMES));
  }
  if (pkg.stack.styling) {
    parts.push(formatItem(pkg.stack.styling, STYLING_NAMES));
  }
  const files = `${pkg.statistics.totalFiles} files`;
  const detail = parts.length > 0 ? `${parts.join(', ')} (${files})` : `(${files})`;
  return `  ${pkg.relativePath} — ${detail}`;
}
```

## Existing Functions to Reuse

- `formatItem(item, nameMap)` — already in display.ts
- `confidenceLabel(convention)` — already in display.ts
- `CONVENTION_LABELS` — already in display.ts
- `FRAMEWORK_NAMES`, `LIBRARY_NAMES`, `STYLING_NAMES`, `ROLE_DESCRIPTIONS` from `@viberails/types`

## New Tests

### `packages/cli/src/display.test.ts`

The existing tests use `console.log` capture. Follow the same pattern:

```typescript
describe('monorepo display', () => {
  it('shows package count in header', () => {
    // Create ScanResult with 3 packages
    displayScanResults(monorepoScanResult);
    expect(output).toContain('monorepo');
    expect(output).toContain('3 packages');
  });

  it('shows per-package framework summary', () => {
    displayScanResults(monorepoScanResult);
    expect(output).toContain('apps/web');
    expect(output).toContain('Next.js');
    expect(output).toContain('apps/mobile');
    expect(output).toContain('Expo');
  });

  it('uses single-package display for non-monorepo', () => {
    displayScanResults(singlePackageScanResult);
    expect(output).not.toContain('monorepo');
  });
});
```

## Verification

```bash
pnpm --filter viberails test  # cli tests pass
pnpm test                     # full suite
```

## Note on Display Scope

The display doesn't need to show every detail — it's a summary for interactive confirmation. The full per-package data is available in `scan-result.json` and the generated `context.md`. Keep the display concise; users can review the config file for details.
