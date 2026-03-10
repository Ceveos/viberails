# Proposal: Interactive Init Menu

## Problem

The current init flow has three UX issues:

1. **Hidden setup questions.** The naming convention question only appears after selecting "Customize." The initial summary shows `~ File naming: not enforced` with no indication the user can (or should) set it. The naming question is a setup concern, not a customization — the tool can't do its job well without it.

2. **Phantom "Also Available" section.** The summary teases two features (`~ Infer boundaries` and `~ Set up hooks, Claude integration, and CI checks`) that the user cannot act on from the current screen. Both are asked later in the flow regardless of whether the user picks "Accept" or "Customize," making the section misleading. Users report confusion about how to access these features.

3. **Prerequisite discovery is late.** Missing packages (coverage providers, hook managers) are surfaced at the end of the flow, after the user has already configured settings that depend on them. If a coverage provider isn't installed, the user configures 80% coverage, walks through integrations, and *then* gets told coverage won't work without an install.

## Proposed Design

Replace the static summary + "Accept / Customize / Review" decision with a single interactive menu that serves as both summary and editor. Every line is a configurable item. The user is done when they select "Done."

### Design Principles

- **One screen.** The user sees every setting and its current state at a glance. No hidden features, no secondary menus to discover.
- **Zero required interactions.** If the scan detected everything cleanly, the user can arrow to "Done" and press enter. The fast path is preserved.
- **Edit in place.** Selecting any line opens its editor (select, text input, sub-menu). When the editor closes, the user returns to the main menu with the hint updated.
- **No silent side effects.** Nothing is installed or written until the user selects "Done" and confirms. Prerequisites (coverage provider, Lefthook) are planned during menu configuration but only executed after the final "Apply this setup?" confirmation.
- **Progressive disclosure for monorepos.** Per-package overrides and boundary inference only appear when `packages.length > 1`.

### Pre-Menu: Informational Notes Only

Before showing the menu, the system checks for missing prerequisites and displays **informational notes** — no installs, no prompts. Actual installation happens after the final confirmation.

**When no test runner is detected:**

```
│  No test runner detected. Coverage checks are inactive until a test runner is installed.
│  Install a test runner (e.g. vitest) and re-run viberails init.
```

This is informational only — no prompt. Missing tests enforcement remains independent of test runner presence (it's a structure rule).

### Main Menu

After informational notes (if any), the user sees:

```
┌  viberails
│
◇  Scan complete
│  Next.js 15 · TypeScript 5 · Tailwind CSS 4
│  pnpm · Biome 2 · Vitest 2
│
◆  Configure viberails
│  ✓ Max file size          300 lines
│  ? File naming            mixed — choose a convention
│  ✓ Missing tests          enforced (*.test.ts)
│  ✓ Coverage               80%
│    Advanced naming        component, hook, and alias conventions
│    Integrations           not configured — select to set up
│  ──────
│    Reset all to defaults
│    Review scan details
│  ● Done — write config
```

#### Status Indicators

| Icon | Meaning | When Used |
|------|---------|-----------|
| `✓` | Configured and ready | Value detected or user-set |
| `?` | Needs user input | Scanner couldn't determine a clear default |
| `~` | Disabled or optional | Feature turned off with a reasonable default |
| (none) | Actionable, not yet visited | Integrations, boundaries, advanced naming |

The `?` indicator is the key differentiator from the current `~`. It tells the user "this item specifically needs your attention" vs "this is fine as-is but you can change it."

Items with `?` show what fallback will be used if the user skips them. For example: `? File naming  mixed — will not enforce if skipped`. This way the user knows what happens if they just hit Done.

#### Menu Items

**Max file size** — Always present. Opens text inputs for source and test file limits.

```
◆  Maximum lines per source file?
│  300

◆  Maximum lines per test file? (0 = no limit)
│  0
```

Returns to menu. Hint updates to new value (e.g., `300 lines` or `300 lines, tests 500`).

**File naming** — Always present. Opens the naming convention picker.

For single-package repos:
```
◆  File naming convention
│  ● kebab-case
│  ○ camelCase
│  ○ PascalCase
│  ○ snake_case
│  ○ Don't enforce
```

For monorepos with per-package detection data:
```
│  Per-package file naming detected:
│  packages/ui: PascalCase (85%)
│  packages/api: kebab-case (94%)
│  packages/web: kebab-case (91%)

◆  Default file naming convention (override per-package later)
│  ● kebab-case          (7 packages)
│  ○ PascalCase          (2 packages)
│  ○ camelCase
│  ○ snake_case
│  ○ Don't enforce
```

If the convention was detected with high confidence (≥90%), the menu shows `✓ File naming  kebab-case (detected)` and selecting it opens the picker pre-filled with the detected value.

If confidence is medium or the codebase is mixed, shows `? File naming  mixed — will not enforce if skipped`.

Returns to menu. Hint updates.

**Missing tests** — Always present. Opens a confirm toggle.

```
◆  Require every source file to have a test file?
│  ● Yes
│  ○ No
```

Missing-test enforcement is a structure rule, not a runtime rule. It is independent of whether a test runner is detected. A project with no test runner can still enforce that test files exist — this is useful on day one as a structural convention even before tests actually run.

Default: `enforceMissingTests: true` from config generation, same as today.

**Coverage** — Always present. Opens a text input for the percentage target.

```
◆  Test coverage target (0 = disable)?
│  80
```

If coverage is enabled and this is a monorepo, the hint shows package coverage counts: `80% (9/10 packages, 1 exempt)`.

When no test runner is detected, coverage shows as inactive rather than green:

```
│  ~ Coverage               80% target (inactive — no test runner)
```

The 80% value is still stored in config so coverage activates automatically when a test runner is later installed.

When a test runner exists but no coverage provider is installed, the coverage item handler offers the three-way choice (install/disable/skip) as a deferred action. The choice is recorded but the actual install runs after the final confirmation:

```
◆  @vitest/coverage-v8 is not installed. Needed for coverage checks.
│  ● Install @vitest/coverage-v8 (after final confirmation)
│  ○ Disable coverage checks
│  ○ Skip for now — I'll install it later
```

**Advanced naming** — Always present. Opens the existing sub-menu for secondary naming conventions.

```
◆  Advanced naming conventions
│  ○ Component naming     (not set)
│  ○ Hook naming          (not set)
│  ○ Import alias         (not set)
│  ● Back
```

Each option opens its existing picker (PascalCase/camelCase for components, useXxx/use-* for hooks, @/*/~/* /Custom/Clear for aliases). These are root-level conventions, not per-package settings.

The hint on the main menu updates to reflect configured values: `PascalCase components, useXxx hooks` or stays `component, hook, and alias conventions` if nothing is set.

**Per-package overrides** — Only for monorepos (`packages.length > 1`).

Opens the existing `promptPackageOverrides` flow. User selects a package, edits its settings (naming, max lines, coverage, coverage paths), returns to package list, then back to main menu.

The hint updates to reflect changes: `10 packages (2 customized)`.

**Boundaries** — Only for monorepos.

Shows `not enabled` as the default state. The user must explicitly opt in.

```
◆  Configure viberails
│  ...
│    Boundaries             not enabled
│  ...
```

Opens a confirm:

```
◆  Infer boundary rules from current import patterns?
│  ● Yes — analyze imports and create deny rules
│  ○ No — skip boundary enforcement
```

If yes: spinner runs, graph analysis happens. Returns to menu with `✓ Boundaries  14 rules across 8 packages`.

If no: returns to menu with `~ Boundaries  not enabled`.

Boundaries never read as a defaulted setting before analysis runs. "Not enabled" is the clear, honest state until the user explicitly opts in.

**Integrations** — Always present. Requires explicit visit before integration files are written.

Default state (not yet visited):
```
│    Integrations           not configured — select to set up
```

When selected, opens a multiselect. If no hook manager is detected, the Lefthook install option is included as the first item:

```
◆  Integrations
│  ☑ Install Lefthook (after final confirmation)
│  ☑ Pre-commit hook (Lefthook)
│  ☑ Typecheck (tsc --noEmit)
│  ☑ Lint check (Biome)
│  ☑ Claude Code hook
│  ☑ CLAUDE.md reference
│  ☑ GitHub Actions workflow
```

If Lefthook is already installed, the first item is absent and pre-commit shows normally:

```
◆  Integrations
│  ☑ Pre-commit hook (Lefthook)
│  ☑ Typecheck (tsc --noEmit)
│  ...
```

The Lefthook install is deferred — it runs after the final confirmation, before integration files are written. If the user deselects the Lefthook install, pre-commit hook shows `(local-only git hook)`.

Returns to menu. Hint updates to reflect selections: `✓ Integrations  pre-commit · typecheck · lint · Claude · CI`.

**If the user selects "Done" without visiting Integrations**, no integration files are written. Only `viberails.config.json`, `.viberails/context.md`, and `.viberails/scan-result.json` are created. This is safe — the user can run `viberails init` again or set up integrations manually later.

**Reset all to defaults** — Always present. Restores all settings to their scan-detected values. Resets the draft config to the originally generated config from the scan.

**Review scan details** — Always present. Shows the full scan report as a `clack.note()`, then returns to menu.

**Done — write config** — Always present. Exits the menu loop and proceeds to the write phase.

When the user selects "Done" and `enforceNaming` is true but no `fileNaming` convention is set on the root package (the user never visited or skipped the `?` item), the system automatically sets `enforceNaming: false`. This prevents an inconsistent config state where naming is "enforced" but no convention is specified.

### Post-Menu: Write Phase

After the user selects "Done":

1. **Final confirmation:**
   ```
   ◇  Apply this setup? Yes
   ```

2. **Execute deferred installs** (if any were planned during menu):
   ```
   ◇  Installing @vitest/coverage-v8...
   │  ✓ Installed @vitest/coverage-v8
   ◇  Installing Lefthook...
   │  ✓ Installed Lefthook
   ```

   If an install fails, the system warns but continues — the user can install manually later.

3. **Write config files:**
   ```
   ◇  Writing configuration...
   │  ✓ viberails.config.json
   │  ✓ .viberails/context.md
   │  ✓ .viberails/scan-result.json
   ```

4. **Set up integrations** (only if the user visited the integrations menu):
   ```
   │  ✓ lefthook.yml — pre-commit + typecheck + lint
   │  ✓ .claude/settings.json — viberails hook
   │  ✓ CLAUDE.md — added reference
   │  ✓ .github/workflows/viberails.yml
   ```

5. **Completion:**
   ```
   └  Done! Run viberails check to verify.
   ```

## Scenario Walkthroughs

### Scenario 1: Quick Adopter — Clean Repo

Well-structured single-package repo. TypeScript, kebab-case at 95%, Vitest installed with coverage provider, Lefthook installed.

**No pre-menu notes** — everything is detected.

```
◆  Configure viberails
│  ✓ Max file size          300 lines
│  ✓ File naming            kebab-case (detected)
│  ✓ Missing tests          enforced (*.test.ts)
│  ✓ Coverage               80%
│    Advanced naming        component, hook, and alias conventions
│    Integrations           not configured — select to set up
│  ──────
│    Reset all to defaults
│    Review scan details
│  ● Done — write config
```

User wants integrations, so they select "Integrations" first → confirms the multiselect defaults → returns to menu with `✓ Integrations  pre-commit · typecheck · Claude · CI`.

Then arrows to Done. Two interactions total.

### Scenario 2: New Project — No Test Runner

Small TypeScript project, no tests yet, mixed naming (60/40 camelCase/kebab), no hook manager.

**Pre-menu: informational note**
```
│  No test runner detected. Coverage checks are inactive until a test runner is installed.
│  Install a test runner (e.g. vitest) and re-run viberails init.
```

**Main menu:**
```
◆  Configure viberails
│  ✓ Max file size          300 lines
│  ? File naming            mixed — will not enforce if skipped
│  ✓ Missing tests          enforced
│  ~ Coverage               80% target (inactive — no test runner)
│    Advanced naming        component, hook, and alias conventions
│    Integrations           not configured — select to set up
│  ──────
│    Reset all to defaults
│    Review scan details
│  ● Done — write config
```

Missing tests is enabled by default — it's a structure rule that's useful even without a test runner. Coverage shows as inactive — the 80% target is stored but won't run checks until a test runner is installed.

User selects "File naming" → picks kebab-case. Selects "Integrations" → sees Lefthook install option at top of multiselect, confirms defaults. Selects Done.

After final confirmation, Lefthook is installed, then integration files are written.

### Scenario 3: Monorepo — Full Customization

10-package monorepo. Mixed naming (some PascalCase in UI packages). Vitest installed, no coverage provider. Lefthook installed.

**No pre-menu notes** — test runner exists, Lefthook installed.

**Main menu:**
```
◆  Configure viberails
│  ✓ Max file size          300 lines
│  ? File naming            mixed — will not enforce if skipped
│  ✓ Missing tests          enforced (*.test.ts)
│  ✓ Coverage               80% (9/10 packages, 1 exempt)
│    Advanced naming        component, hook, and alias conventions
│    Per-package overrides  10 packages
│    Boundaries             not enabled
│    Integrations           not configured — select to set up
│  ──────
│    Reset all to defaults
│    Review scan details
│  ● Done — write config
```

User selects "Coverage" → sees the three-way coverage provider prompt (install/disable/skip) → chooses "Install (after final confirmation)". Returns to menu, coverage still shows `✓ Coverage  80%`.

User selects "File naming":
```
│  Per-package file naming detected:
│  packages/ui: PascalCase (85%)
│  packages/api: kebab-case (94%)
│  packages/web: kebab-case (91%)

◆  Default file naming convention (override per-package later)
│  ● kebab-case          (7 packages)
│  ○ PascalCase          (2 packages)
│  ○ camelCase
│  ○ snake_case
│  ○ Don't enforce
```

Picks kebab-case. Returns to menu.

User selects "Per-package overrides":
```
◆  Select package to edit
│  ○ packages/ui           PascalCase
│  ○ packages/api          (no overrides)
│  ○ packages/web          (no overrides)
│  ○ packages/types        exempt (types-only)
│  ○ packages/config       (no overrides)
│  ...
│  ● Done
```

Selects `packages/ui` → keeps PascalCase override for the UI package. Returns to main menu.

User selects "Boundaries":
```
◆  Infer boundary rules from current import patterns?
│  ● Yes
│  ○ No
```

Picks Yes. Spinner runs. Returns: `✓ Boundaries  14 rules across 8 packages`.

User selects "Integrations" → confirms defaults. Returns to menu.

User selects "Done." After confirmation, coverage provider is installed, then config and integration files are written.

### Scenario 4: Legacy Codebase — Lenient Setup

Large JavaScript project, no TypeScript, no tests, 800-line files common, no linter.

**Pre-menu: informational note**
```
│  No test runner detected. Coverage checks are inactive until a test runner is installed.
│  Install a test runner (e.g. vitest) and re-run viberails init.
```

**Main menu:**
```
◆  Configure viberails
│  ✓ Max file size          300 lines
│  ? File naming            mixed — will not enforce if skipped
│  ✓ Missing tests          enforced
│  ~ Coverage               80% target (inactive — no test runner)
│    Advanced naming        component, hook, and alias conventions
│    Integrations           not configured — select to set up
│  ──────
│    Reset all to defaults
│    Review scan details
│  ● Done — write config
```

User selects "Max file size" → changes to 500.
User selects "File naming" → picks "Don't enforce."
User selects "Missing tests" → disables.
User selects "Coverage" → sets to 0.

```
◆  Configure viberails
│  ✓ Max file size          500 lines
│  ✓ File naming            not enforced
│  ~ Missing tests          not enforced
│  ~ Coverage               disabled
│    Advanced naming        component, hook, and alias conventions
│    Integrations           not configured — select to set up
│  ──────
│    Reset all to defaults
│    Review scan details
│  ● Done — write config
```

User selects Done without visiting Integrations. Only config files are written — no hook/CI files created. Lean setup that won't fight the codebase.

### Scenario 5: Accept Defaults — Monorepo

Everything detected cleanly. High-confidence naming, Vitest + coverage installed, Lefthook installed.

**No pre-menu notes.**

```
◆  Configure viberails
│  ✓ Max file size          300 lines
│  ✓ File naming            kebab-case (detected)
│  ✓ Missing tests          enforced (*.test.ts)
│  ✓ Coverage               80% (9/10 packages, 1 exempt)
│    Advanced naming        component, hook, and alias conventions
│    Per-package overrides  10 packages
│    Boundaries             not enabled
│    Integrations           not configured — select to set up
│  ──────
│    Reset all to defaults
│    Review scan details
│  ● Done — write config
```

User wants the full setup: selects "Integrations" → confirms defaults. Selects "Boundaries" → picks Yes → inference runs.

Then selects Done. Boundaries and integrations are set up because the user explicitly visited them.

If the user just wants config without integrations, they arrow straight to Done. No integration files are written.

## What Changes

### Removed from init path

| Current | Why |
|---------|-----|
| `displayInitOverview()` | Replaced by the menu itself — status indicators on each line ARE the overview |
| `promptInitDecision()` | No more "Accept / Customize / Review" fork — the menu handles all three |
| `displaySetupPlan()` | The menu already shows everything; final confirmation is a simple yes/no |
| "Also Available" section | Every feature is a menu item — nothing is hidden |
| `resolveNamingDefault()` | Logic folded into the "File naming" menu item handler |

Note: `promptRuleMenu()`, `applyRuleOverrides()`, `buildMenuOptions()`, `handleMenuChoice()` etc. remain in the codebase for the `config` command, which still uses the existing rule menu flow. Only the init path changes.

### Kept (reused as-is)

| Current | Role in New Flow |
|---------|-----------------|
| `promptFileLimitsMenu()` | Called from "Max file size" handler (or inlined as two text inputs) |
| `promptNamingMenu()` submenus | Component naming, hook naming, import alias reused in "Advanced naming" |
| `promptPackageOverrides()` | Called when user selects "Per-package overrides" |
| `checkCoveragePrereqs()` | Called when user selects "Coverage" and provider is missing |
| `setupSelectedIntegrations()` | Called after writing config (unchanged) |
| `formatScanResultsText()` | Used in "Review scan details" |

### New

| Component | Purpose |
|-----------|---------|
| `prompt-main-menu.ts` | The interactive menu loop — builds options, handles selection, delegates to sub-flows |
| `DeferredInstall` interface | Tracks planned-but-not-executed installs (coverage provider, Lefthook) |

### Modified

| Current | Change |
|---------|--------|
| `initInteractive()` in `init.ts` | Restructured: scan → informational notes → main menu → confirm → execute deferred installs → write |
| `promptIntegrations()` | Extended to include Lefthook install as a deferred multiselect option when no hook manager detected |
| `promptMissingPrereqs()` | Changed to return a deferred install plan instead of executing immediately |

## State Management

The menu operates on a draft `ViberailsConfig` directly. The config is generated from the scan result before the menu opens, and each menu item handler mutates the draft in place.

There is no `RuleOverrides` intermediate state in the init path. The menu reads from and writes to the config object directly. This eliminates the current inconsistency where some settings live in `RuleOverrides` and others are mutated on the config directly.

A small metadata object tracks UI-only concerns:

```typescript
interface InitMenuState {
  /** Which items the user has explicitly visited */
  visited: {
    integrations: boolean;
    boundaries: boolean;
  };
  /** Deferred package installs to run after confirmation */
  deferredInstalls: DeferredInstall[];
  /** Integration selections (only used if visited.integrations is true) */
  integrations?: IntegrationChoice;
  /** Whether a test runner was detected */
  hasTestRunner: boolean;
  /** Whether a hook manager is available */
  hookManager: string | undefined;
}

interface DeferredInstall {
  label: string;
  command: string;
  /** Callback to run on install failure (e.g., disable coverage) */
  onFailure?: () => void;
}
```

The `config` command continues to use `RuleOverrides` + `applyRuleOverrides()` unchanged.

## Migration Path

The refactor is done in three phases. Each is independently shippable and testable.

### Phase 1: Extract and decouple prerequisites

Current state: prerequisite checks (coverage provider, hook manager) are tightly coupled to the integration prompt and happen late in the flow. The coverage provider check runs after customization. The Lefthook install prompt is embedded inside `promptIntegrations()`.

This phase:
- Extracts `promptHookManagerInstall()` from `promptIntegrations()` so it can be called independently or deferred
- Makes `promptMissingPrereqs()` return a deferred install plan (command + label) instead of executing immediately
- Adds a `DeferredInstall` type and an `executeDeferredInstalls()` function
- Keeps the existing init flow order (no UX change yet) — just decouples the pieces

**Files changed:** `check-prerequisites.ts`, `prompt-integrations.ts`, new types in a shared location
**Tests:** Update prereq tests for the new return type; add tests for `executeDeferredInstalls()`
**User impact:** None — behavior is identical, just restructured internally.

### Phase 2: Replace init flow with main menu

Create `promptMainMenu()` that replaces `displayInitOverview()` + `promptInitDecision()` + `promptRuleMenu()`. The new function:

- Builds menu options with status indicators from the current draft config
- Delegates to existing sub-menu functions (file limits, naming, testing, package overrides)
- Adds integrations, boundaries, and advanced naming as menu items
- Includes "Reset all," "Review scan details," and "Done"
- Operates on draft `ViberailsConfig` directly (no `RuleOverrides`)
- Handles the `?` File naming with `resolveNamingDefault` logic inline
- Finalizes naming on Done (sets `enforceNaming: false` if no convention chosen)
- Returns the deferred installs and integration choices

Restructure `initInteractive()`:
- scan → informational notes → `promptMainMenu()` → confirm → execute deferred installs → write config → setup integrations (if visited)

Remove from init path (code stays for `config` command):
- `displayInitOverview()` / `displaySetupPlan()` — only used in init, can be deleted
- `promptInitDecision()` — only used in init, can be deleted
- `resolveNamingDefault()` — only used in init, can be deleted

**Files changed:** New `prompt-main-menu.ts`, modified `init.ts`. Delete `display-init.ts`, `prompt-naming-default.ts`. Remove `promptInitDecision` from `prompt.ts`.
**Tests:** New tests for `promptMainMenu()` and hint builders. Existing sub-menu tests unchanged. Delete `display-init.test.ts` and `prompt-naming-default.test.ts`.
**User impact:** The "Accept / Customize / Review" decision is replaced by the interactive menu. All features visible and editable from one screen.

### Phase 3: Polish and edge cases

- Coverage without test runner shows `~` inactive state
- Coverage item handler triggers the three-way prereq choice and records deferred install
- Integrations submenu includes Lefthook install option when no hook manager detected
- Deferred installs execute after final confirmation
- Edge case tests: cancel at every prompt point, reset after modifications, Done with unresolved `?` items

**Files changed:** `prompt-main-menu.ts`, `init.ts`
**Tests:** Edge case and integration tests
**User impact:** Full new flow is complete with all deferred installs and edge cases handled.

## Decisions

These were open questions in the initial draft, now resolved based on two rounds of review feedback:

1. **"Done" with unresolved `?` items:** Allowed. If `enforceNaming` is true but no `fileNaming` is set, the Done handler automatically sets `enforceNaming: false` to prevent inconsistent config. The `?` row shows what fallback will be written.

2. **Integrations require explicit visit:** No integration files are written unless the user enters the integrations submenu. Computed defaults are shown as a preview in the hint text only.

3. **No silent side effects — deferred installs:** Coverage provider and Lefthook installs are planned during menu configuration but only executed after the final "Apply this setup?" confirmation. If an install fails, the system warns and continues.

4. **Reset all is kept.** It remains valuable in a loop-based editor for quickly reverting experimentation.

5. **Advanced naming is a separate menu item.** Component naming, hook naming, and import alias are root-level conventions in their own "Advanced naming" row, not hidden inside per-package overrides.

6. **Missing tests is independent of test runner detection.** It's a structure rule (does a test file exist?), not a runtime rule. Enforcing test file existence is useful on day one.

7. **Boundaries show "not enabled" until explicitly opted in.** The menu never implies boundaries are configured before the user runs inference.

8. **Test runner installation is out of scope.** Detecting a missing test runner results in an informational message, not an installer.

9. **Coverage without test runner shows inactive.** Coverage shows `~ 80% target (inactive — no test runner)` instead of `✓ 80%` — honest about what will actually run.

10. **Lefthook install lives in the Integrations submenu.** When no hook manager is detected, it appears as a selectable item in the integrations multiselect (deferred until after confirmation), not as a pre-menu prompt.

11. **State management uses draft config directly.** The init path mutates a draft `ViberailsConfig` — no intermediate `RuleOverrides`. The `config` command keeps its existing `RuleOverrides` + `applyRuleOverrides()` pattern unchanged.
