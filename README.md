# viberails

Guardrails for vibe coding.

A CLI that scans your existing JavaScript or TypeScript project, generates rich AI context files, and enforces architectural conventions — based on what you've actually built, not a template.

## Quick Start

```bash
cd your-project
npx viberails
```

That's it. viberails scans your project and generates everything.

## What It Generates

| File | Purpose |
|------|---------|
| `viberails.config.json` | Detected stack, conventions, and rule thresholds |
| `.viberails/context.md` | AI context in natural language — the source of truth |
| `CLAUDE.md` | Claude Code entry point with `@import` directive |
| `.cursorrules` | Cursor IDE context (generated from context.md) |

All generated files are derived from your actual codebase — not boilerplate.

## Commands

### `npx viberails` (or `viberails init`)

Scans your project and generates all context files. Prompts for confirmation before writing.

**Options:**

- `--yes` / `-y` — Non-interactive mode. Uses defaults, includes only high-confidence conventions.

### `viberails sync`

Re-scans your project and regenerates context files. Preserves any manual edits you've made to `viberails.config.json`.

Run this after:

- Adding new directories or patterns to your project
- Updating dependencies
- Significantly refactoring structure

## How It Works

1. **Scan** — Reads `package.json` to detect your framework, language, styling, and tooling. Walks your directory tree to map structure and analyze naming conventions.

2. **Detect** — Each convention comes with a confidence level based on consistency across your codebase.

3. **Generate** — Produces `context.md` in natural language, then derives `CLAUDE.md` and `.cursorrules` from it.

## Confidence Model

| Level | Consistency | Behavior |
|-------|-------------|----------|
| High | ≥ 90% | Included and enforced by default |
| Medium | 70–89% | Included as suggestion, not enforced |
| Low | < 70% | Omitted entirely |

In `--yes` mode, only high-confidence conventions are included.

## Learn More

Documentation and examples at [viberails.sh](https://viberails.sh).

## License

MIT
