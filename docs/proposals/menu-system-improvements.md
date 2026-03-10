# Menu System: Current Problems & Proposed Solutions

Assessment of the interactive init menu system introduced in `7c1bc2e`.
Updated after external review (Codex) surfaced two additional high-severity bugs.

Items marked **(FIXED)** have been resolved. Item 6 (untested handlers) remains open.

---

## 1. Advanced naming data-loss bug **(FIXED)**

**Problem:** `promptNamingMenu()` allows editing `enforceNaming` and `fileNamingValue`, but `applyAdvancedNamingToConfig()` only wrote back `componentNaming`, `hookNaming`, and `importAlias`. File naming changes made in the Advanced Naming submenu were silently discarded.

**Fix:** Merged the two adapter functions (`configToAdvancedNamingState` + `applyAdvancedNamingToConfig`) into a single `handleAdvancedNaming()` that writes back all fields including `enforceNaming` and `fileNamingValue`.

---

## 2. Sticky deferred installs **(FIXED)**

**Problem:** Two sub-problems:
- **Coverage:** Once a coverage install was queued, revisiting Coverage skipped the prereq choice entirely (the guard `!state.deferredInstalls.some(...)` was false), jumping straight to the text prompt. The user could not change their mind.
- **Integrations:** Revisiting integrations and unchecking "Install Lefthook" did not remove the previously queued install from `state.deferredInstalls`.

**Fix:**
- Coverage: Always show the prereq choice when a missing provider is detected. Before re-adding, filter out any existing install with the same command.
- Integrations: After calling `promptIntegrationsDeferred`, always sync the deferred installs list — filter out any existing lefthook install, then re-add only if returned.

---

## 3. Boundary error handling **(FIXED)**

**Problem:** `handleBoundaries()` started a spinner, dynamically imported `@viberails/graph`, and ran `buildImportGraph` + `inferBoundaries` with no try-catch. A failure would leave the spinner running and crash the CLI.

**Fix:** Wrapped graph operations in try-catch. On failure, the spinner stops with an error message and a warning is logged. The menu continues normally.

---

## 4. Unsafe type cast **(FIXED)**

**Problem:** `promptFileLimitsMenu` accepted `RuleOverrides` (12 fields) but only used `maxFileLines` and `maxTestFileLines`. The caller used `as RuleOverrides` to silence the type mismatch.

**Fix:** Narrowed `promptFileLimitsMenu`'s signature to `Pick<RuleOverrides, 'maxFileLines' | 'maxTestFileLines'>`. Removed the cast. Inlined the adapter at the call site.

---

## 5. Asymmetric adapters / data-loss **(FIXED)**

**Problem:** `configToAdvancedNamingState` read 10 fields but `applyAdvancedNamingToConfig` only wrote back 3. Changes to `enforceNaming` and `fileNamingValue` were silently dropped.

**Fix:** Resolved as part of fix #1 — the merged `handleAdvancedNaming()` writes back all editable fields.

---

## 6. Untested menu handlers (OPEN)

**Problem:** Several handlers have zero test coverage:

| Handler | What's untested |
|---------|-----------------|
| `handleAdvancedNaming` | Round-trip of enforceNaming/fileNamingValue through promptNamingMenu |
| `handleCoverage` (prereq path) | Deferred install creation, 3-way choice, revisit behavior |
| `handleBoundaries` | Dynamic import, spinner lifecycle, error handling path |
| `handleFileNaming` (monorepo path) | Per-package display, monorepo-specific note |
| `handlePackageOverrides` | Delegation to promptPackageOverrides |

**Proposed solution:** Add tests for each handler, mocking external dependencies. Priority: `handleCoverage` > `handleBoundaries` > `handleAdvancedNaming` > others.

---

## 7. Dead code: `promptIntegrations` **(FIXED)**

**Problem:** `promptIntegrations()` and `promptHookManagerInstall()` were dead — replaced by `promptIntegrationsDeferred()` but left in place with ~140 lines of source + test code.

**Fix:** Deleted both functions, the `spawnAsync` import, the re-export from `prompt.ts`, and all associated tests.

---

## 8. Package-override hint semantics **(FIXED)**

**Problem:** `packageOverridesHint()` counted packages as "customized" when they had `conventions`, `rules`, or `coverage`. But scanner-generated packages always have `conventions` from detection, so all packages appeared "customized" by default.

**Fix:** Changed to only count `rules` or `coverage` as customization signals. Updated and added tests.

---

## 9. Icon cleanup **(FIXED)**

**Problem:** `statusIcon` had a dead `'none'` branch that was never called.

**Fix:** Removed the `'none'` type from the union and simplified the function.

---

## 10. Fragile dedup logic **(FIXED)**

**Problem:** Deferred installs were deduplicated by label string comparison, which is fragile.

**Fix:** Resolved as part of fix #2 — coverage dedup now uses command comparison, integrations dedup uses `command.includes('lefthook')`.

---

## Summary

| # | Problem | Severity | Status |
|---|---------|----------|--------|
| 1 | Advanced naming data-loss | High | Fixed |
| 2 | Sticky deferred installs | High | Fixed |
| 3 | Boundary error handling | Medium | Fixed |
| 4 | Unsafe type cast | Medium | Fixed |
| 5 | Asymmetric adapters | Medium | Fixed (with #1) |
| 6 | Untested handlers | High | Open |
| 7 | Dead code | Low | Fixed |
| 8 | Package-override hint | Medium | Fixed |
| 9 | Icon dead branch | Low | Fixed |
| 10 | Fragile dedup | Low | Fixed (with #2) |
