# viberails

Guardrails for vibe coding.

viberails scans your existing JavaScript/TypeScript project, detects the conventions you're already following, and enforces them with file-level feedback during AI edits and structured enforcement at commit and PR time. Rules are derived from your actual codebase, not a template.

## Why

AI coding tools are fast but inconsistent. They'll use camelCase in one file and kebab-case in another, create 500-line files, and ignore your project's import boundaries. viberails catches this by learning your conventions and enforcing them where it matters: file-level checks surface naming and size issues immediately during AI edits, while commit hooks and CI enforce naming, file-size, missing-test, and boundary rules. Coverage enforcement runs via `viberails check` (full mode).

## Quick Start

```bash
cd your-project
npx viberails
```

The interactive wizard scans your project, shows what it found with confidence levels, and lets you customize rules before generating config. It also sets up pre-commit hooks and Claude Code integration.
If a config already exists, re-running `viberails` lets you edit it, replace it with a fresh scan, or cancel. `viberails config` remains available as a shortcut for direct rule editing.

## What It Does

**Scans** your codebase to detect framework, language, styling, tooling, directory structure, and naming conventions, each scored by consistency across your files.

**Enforces** four rules:
- **File size** — files over 300 lines (configurable) are flagged
- **Naming conventions** — detects your naming style (kebab-case, camelCase, PascalCase, snake_case) and enforces it
- **Missing tests** — source files must have corresponding test files
- **Import boundaries** — prevents packages from importing where they shouldn't (monorepos)

**Fixes** violations automatically:
- Renames files to match your convention and updates relative imports via AST rewriting (aliased imports like `@/...` require manual updates)
- Generates test stubs for missing test files

## What It Generates

| File | Purpose |
|------|---------|
| `viberails.config.json` | Detected stack, conventions, boundary rules, and thresholds |
| `.viberails/context.md` | Enforced rules in natural language for AI tools to follow |
| `.viberails/scan-result.json` | Raw scan data (gitignored) |

The generated `context.md` is designed to be referenced from your `CLAUDE.md`, `.cursorrules`, or similar AI context files so that AI tools automatically follow your project's conventions.

## Commands

### `npx viberails` / `viberails init`

Scans your project and walks you through setup. If a config already exists, the same command lets you edit the current setup or replace it with a fresh scan.

| Flag | Effect |
|------|--------|
| `--yes` / `-y` | Non-interactive. Uses defaults, keeps high-confidence conventions, and auto-sets up integrations. |
| `--force` / `-f` | Re-initialize from scratch, replacing existing config without the edit/replace chooser. |

### `viberails check`

Validates your project against configured rules.

| Flag | Effect |
|------|--------|
| `--staged` | Check only git-staged files (used by pre-commit hook). |
| `--files <paths>` | Check specific files. |
| `--format json` | Machine-readable output for tool integration. |
| `--quiet` | Summary only. |
| `--enforce` | Return exit code 1 when violations are found (CI mode). |
| `--diff-base <ref>` | Check only files changed since a git ref (useful in CI). |
| `--hook` | Output via stdin/stderr for Claude Code hook integration. |

### `viberails fix`

Auto-fixes naming violations and generates missing test stubs.

| Flag | Effect |
|------|--------|
| `--dry-run` | Preview changes without applying them. |
| `--rule <name>` | Fix only `file-naming` or `missing-test`. |
| `--yes` / `-y` | Apply fixes without confirmation. |

### `viberails config`

Interactively edit existing config rules without re-initializing. Opens the same rule menu used during `init` with your current values pre-filled. Most users can simply re-run `viberails`; this command is the direct shortcut.

| Flag | Effect |
|------|--------|
| `--rescan` | Re-scan the project first, picking up new packages and stack changes. |

### `viberails sync`

Re-scans and regenerates context files. Preserves manual edits to `viberails.config.json` and reports what changed.

| Flag | Effect |
|------|--------|
| `--interactive` / `-i` | Review changes before writing. Choose to accept, customize rules, or cancel. |

### `viberails boundaries`

Displays boundary rules and violations. Use `--infer` to re-infer rules from your current import graph.

## Hooks

During `viberails init`, you can set up automatic enforcement:

### Pre-commit hook

Detects your hook manager (Lefthook, Husky, or bare git) and adds `viberails check --staged`. Violations warn by default. Use `viberails check --enforce` (for CI) to make violations fail with exit code 1.

### Claude Code hook

Adds a PostToolUse hook to `.claude/settings.json` that runs fast file-scoped checks after every edit, surfacing naming and file-size issues immediately. Repository-level checks like missing tests and boundaries are enforced at commit and PR time via staged checks and CI. Coverage enforcement runs via `viberails check` (full mode) or your existing CI test pipeline.

### GitHub Actions

Generates a `.github/workflows/viberails.yml` workflow that runs `viberails check --enforce --diff-base` on pull requests, checking only files changed in the PR.

### Typecheck & lint hooks

Optionally adds `tsc --noEmit` and your linter (Biome, ESLint) as pre-commit checks during `viberails init`.

## Confidence Model

Not all conventions are equally consistent in a codebase. viberails scores each detection:

| Level | Consistency | Behavior |
|-------|-------------|----------|
| **High** | >= 90% | Enforced by default |
| **Medium** | 70-89% | Included in config, not enforced |
| **Low** | < 70% | Omitted entirely |

In `--yes` mode, only high-confidence conventions are included.

## Monorepo Support

viberails detects workspaces (pnpm, npm, yarn), scans each package independently, and infers import boundaries from your existing dependency graph. Packages that don't import from each other get automatic deny rules, preventing accidental coupling before it starts.

Per-package convention overrides are detected and displayed during setup.

## License

MIT
