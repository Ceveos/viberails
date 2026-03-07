# Monorepo-First Scanner Refactor — Overview

## Problem

Running viberails on a monorepo (e.g., Next.js frontend + Expo mobile + shared packages) produces inaccurate results:
- Detects "javascript" instead of TypeScript (TS is in workspace packages, not root)
- Misses frameworks like Next.js and Expo (declared in workspace packages)
- Misclassifies directories (`apps/web/lib` → "Hooks" instead of "Utils")
- Mixes conventions from different apps (Expo uses PascalCase, Next.js uses kebab-case → reports 60% kebab-case)

## Root Cause

The scanner treats everything as a single flat project. It merges all workspace deps into one bag, walks all directories together, and detects one set of conventions globally.

## Solution

**Scan each workspace package independently, then aggregate.** A single-package project is just a monorepo with one package — same code path, no special cases.

## Architecture

```
scan()
  ├─ detectWorkspace()
  ├─ if monorepo: scanPackage() for each workspace package (parallel)
  │   └─ aggregate into global fields
  └─ if single-package: scanPackage() for root
      └─ global fields = package fields
```

## Phases

| Phase | What | Files Changed |
|-------|------|---------------|
| [Phase 1](./01-types.md) | Add new types | `packages/types/src/scan-result.ts`, `config.ts`, `index.ts` |
| [Phase 2](./02-scan-package.md) | Create `scanPackage()` | `packages/scanner/src/scan-package.ts` (NEW) |
| [Phase 3](./03-aggregation.md) | Create aggregation functions | `packages/scanner/src/aggregate.ts` (NEW) |
| [Phase 4](./04-refactor-scan.md) | Refactor `scan()` orchestrator | `packages/scanner/src/scan.ts`, `detect-stack.ts`, `index.ts` |
| [Phase 5](./05-config.md) | Config generation with per-package overrides | `packages/config/src/generate-config.ts`, `merge-config.ts`, `schema.ts` |
| [Phase 6](./06-context.md) | Context generation with per-package sections | `packages/context/src/generate-context.ts` |
| [Phase 7](./07-cli-display.md) | CLI display for monorepos | `packages/cli/src/display.ts` |
| [Phase 8](./08-check-command.md) | Per-package rule resolution in check | `packages/cli/src/commands/check.ts` |

## Dependency Order

Phases must be done in order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8. Each phase builds on the previous.

## Key Principle

All existing top-level fields on `ScanResult` and `ViberailsConfig` remain. For single-package projects, behavior is identical to today. The `packages` array is additive — existing consumers continue to work using aggregate data.

## Running Tests

```bash
pnpm test                           # full suite
pnpm --filter @viberails/scanner test  # scanner only
pnpm --filter @viberails/config test   # config only
pnpm --filter @viberails/context test  # context only
pnpm --filter viberails test           # cli only
```

## Test Fixture

There's a monorepo test fixture at `tests/fixtures/monorepo-nextjs-expo/` with:
- Root `package.json` with `workspaces: ["apps/*", "packages/*"]`
- `apps/web/` — Next.js 15 + Tailwind + TypeScript
- `apps/mobile/` — Expo + React Native
- `packages/shared/` — Zod
- Source files in components/, hooks/, lib/, app/api/ directories
