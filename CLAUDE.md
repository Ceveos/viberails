# viberails

Guardrails for vibe coding. A CLI that scans your existing codebase, generates rich AI context, and enforces architectural conventions.

## What This Project Is

viberails is a free, open-source CLI and library. It does three things:

1. **Scans** an existing JS/TS project to detect stack, structure, conventions, and dependency graph
2. **Generates** AI context files (CLAUDE.md, .cursorrules) derived from the actual codebase — not templates
3. **Enforces** detected conventions via pre-commit hooks and checks (V1.1+)

viberails is not a framework, scaffold tool, or starter kit. It works on the project you already have.

## Current Version Scope

**V1.0 — Scanner + AI Context Generation (what we're building now)**

- Scanner: package.json detection, directory structure analysis, convention inference with confidence model
- Config system: JSON schema, parser, defaults, generation from scan results
- Context generator: `.viberails/context.md` from config + scan results
- CLI: `npx viberails` interactive init flow, `viberails sync`
- Programmatic API: all packages export clean public interfaces

**NOT in V1.0 (deferred to V1.1+):**

- Pre-commit hooks and Lefthook integration
- `viberails check` and `viberails fix` commands
- Boundary enforcement (ESLint plugin or custom checker)
- Import graph / AST analysis
- Monorepo support (workspace detection, per-project scanning)
- CI check generation

Build V1.0 fully before starting any V1.1 work.

## Repository Structure

```
viberails/
├── packages/
│   ├── types/          # @viberails/types — shared type definitions (Confidence, ScanResult, ViberailsConfig, etc.)
│   ├── scanner/        # @viberails/scanner — project scanning (package.json, directory structure, conventions)
│   ├── config/         # @viberails/config — config generation, loading, merging, JSON schema, defaults
│   ├── context/        # @viberails/context — AI context file generation from config + scan results
│   └── cli/            # viberails — CLI tool, thin wrapper over the above packages
├── tests/
│   ├── fixtures/       # Test fixture projects (various stacks, structures)
│   └── integration/    # Full CLI workflow tests
├── turbo.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── vitest.workspace.ts
├── package.json
├── CLAUDE.md           # This file
└── README.md
```

### Package Dependency Graph

```
types ← scanner ← config ← context ← cli
                                  ↗
         types ← config ──────────
```

- `@viberails/types` depends on nothing — pure type definitions
- `@viberails/scanner` depends on `@viberails/types`
- `@viberails/config` depends on `@viberails/types`
- `@viberails/context` depends on `@viberails/types`, `@viberails/config`
- `viberails` (cli) depends on all packages above

No circular dependencies. No package may import from `cli`. The `types` package has zero runtime dependencies.

## Tech Stack (viberails itself)

| Component | Choice | Notes |
|-----------|--------|-------|
| Language | TypeScript (strict mode) | `"strict": true` in tsconfig |
| Package manager | pnpm | Workspace protocol for internal deps |
| Monorepo orchestrator | Turborepo | Build caching, task pipeline |
| Testing | Vitest | Workspace-level vitest config, per-package test files |
| CLI framework | Commander.js | Lightweight, good TS support |
| Config format | JSON | Not TypeScript, not YAML. JSON is universally parseable. |
| Build | tsup | Fast, simple bundling for each package |

## Coding Conventions

### File Naming
- All source files use **kebab-case**: `scan-result.ts`, `detect-stack.ts`, `generate-context.ts`
- Test files use `*.test.ts` suffix, colocated with source: `src/detect-stack.test.ts`
- One module per file. If a file exceeds 200 lines, split it.

### Exports
- Each package has a single `src/index.ts` barrel export
- Public API functions and types are exported from the barrel
- Internal helpers are NOT exported from the barrel — import them directly within the package

### TypeScript
- Strict mode everywhere. No `any` unless absolutely necessary (and commented why).
- Prefer `interface` over `type` for object shapes that may be extended
- Use `type` for unions, intersections, and utility types
- All public functions have JSDoc comments describing purpose, params, and return value

### Testing
- Every public function has unit tests
- Scanner detection logic uses fixture-based testing (real project directories)
- Context generation uses snapshot tests (generated markdown compared to expected output)
- Tests use real filesystem operations with temp directories — no filesystem mocks
- Test descriptions use plain English: `it('detects Next.js 15 from package.json dependencies')`

### Error Handling
- Functions that can fail return descriptive errors, never throw unexpectedly
- Scanner functions that encounter missing files degrade gracefully (skip that detection, don't crash)
- CLI catches all errors and prints human-readable messages

### Dependencies
- Minimize external runtime dependencies. The scanner should be fast and lightweight.
- `typescript` is a peer dependency (used for AST analysis in V1.1+, needed for type resolution)
- Do not add dependencies without clear justification

## Core Type Definitions

These types live in `@viberails/types` and are the contracts between all packages. Get them right early — changing them later requires updating every package.

```typescript
// Confidence model — central to the scanner's value
export type Confidence = 'high' | 'medium' | 'low';

export interface DetectedConvention<T = string> {
  value: T;
  confidence: Confidence;
  sampleSize: number;    // How many files were analyzed
  consistency: number;   // 0-100 percentage
}

// Scanner output — consumed by config and context generators
export interface ScanResult {
  root: string;
  stack: DetectedStack;
  structure: DetectedStructure;
  conventions: Record<string, DetectedConvention>;
  statistics: CodebaseStatistics;
  // V1.1+: importGraph, workspace, projects
}

export interface DetectedStack {
  framework?: StackItem;          // e.g. { name: 'nextjs', version: '15' }
  language: StackItem;
  styling?: StackItem;
  backend?: StackItem;
  packageManager: StackItem;
  linter?: StackItem;
  testRunner?: StackItem;
  libraries: StackItem[];         // Notable libraries (Zod, tRPC, React Query, etc.)
}

export interface StackItem {
  name: string;
  version?: string;
}

export interface DetectedStructure {
  srcDir?: string;                // 'src' if src/ exists, undefined if flat
  directories: DirectoryInfo[];   // Detected meaningful directories
  testPattern?: DetectedConvention<string>;
}

export interface DirectoryInfo {
  path: string;                   // Relative to project root
  role: DirectoryRole;            // What this directory is for
  fileCount: number;
  confidence: Confidence;
}

export type DirectoryRole =
  | 'pages'
  | 'components'
  | 'hooks'
  | 'utils'
  | 'types'
  | 'tests'
  | 'styles'
  | 'api'
  | 'config'
  | 'unknown';

export interface CodebaseStatistics {
  totalFiles: number;
  totalLines: number;
  averageFileLines: number;
  largestFiles: FileStatistic[];  // Top 5 by line count
  filesByExtension: Record<string, number>;
}

export interface FileStatistic {
  path: string;
  lines: number;
}

// Config — the source of truth for guardrails and context generation
export interface ViberailsConfig {
  $schema?: string;
  version: number;                // Always 1 for now
  name: string;
  enforcement: 'warn' | 'enforce';

  stack: ConfigStack;
  structure: ConfigStructure;
  conventions: ConfigConventions;
  rules: ConfigRules;
  ignore: string[];

  // V1.1+: workspace, projects, boundaries
}
```

## Key Design Decisions

### Confidence Model

The confidence model is central to trust-building. Every detected convention has a confidence level:

- **High (≥90% consistency):** Enforced by default. Shown with ✓ in CLI output.
- **Medium (70–89%):** Included in config with annotation, NOT enforced by default. Shown with ~ in CLI output.
- **Low (<70%):** Omitted from config entirely. Noted in status as "mixed."

In `--yes` mode (non-interactive), only high-confidence conventions are included.

### Scanner Architecture

The scanner is built as composable detection functions, each responsible for one concern:

- `detectStack(projectPath)` → reads package.json, returns DetectedStack
- `detectStructure(projectPath)` → walks directory tree, returns DetectedStructure
- `detectConventions(projectPath, structure)` → analyzes file naming patterns, returns conventions
- `computeStatistics(projectPath)` → counts files and lines, returns CodebaseStatistics

The top-level `scan()` function composes these and returns a unified ScanResult.

### Config Generation

Config is generated from ScanResult with smart defaults:
- enforcement: "warn" (always starts in warn-only)
- maxFileLines: 300
- maxFunctionLines: 50
- requireTests: true
- enforceNaming: true
- Only high-confidence conventions become enforced rules

### Context Generation

The generated `.viberails/context.md` is the primary output. It must be:
- Written in natural language (AI instructions, not config syntax)
- Derived from actual scan data (not templates)
- Accurate enough that a developer trusts it without heavy editing
- Structured for AI tools to follow (conventions as directives, boundaries as rules)

## What NOT to Build

- No runtime abstractions or wrappers around user's tools
- No file modification of user code — viberails generates its own files only
- No installation of linters, formatters, or test runners
- No network requests (no telemetry, no update checks in V1)
- No interactive prompts in library packages — only the CLI package prompts
- No V1.1 features (hooks, guardrails, boundaries, fix command, monorepo support)

## Commit Standards

- Conventional commits: `feat:`, `fix:`, `test:`, `refactor:`, `docs:`, `chore:`
- Scope by package: `feat(scanner): add convention detection`
- Every commit should leave the project in a buildable, testable state
- Tests pass before every commit — no broken test commits

@.viberails/context.md
