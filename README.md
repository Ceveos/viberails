# viberails

Guardrails for vibe coding.

A CLI that scans your existing JavaScript or TypeScript project, detects conventions, infers architectural boundaries, and enforces them on every commit — based on what you've actually built, not a template.

## Installation

```bash
# Run directly (no install needed)
npx viberails

# Or install as a dev dependency
npm install -D viberails
# or
pnpm add -D viberails
```

## Quick Start

```bash
cd your-project
npx viberails
```

viberails launches an interactive wizard that scans your project, shows detected conventions with confidence levels, and lets you customize rules before generating config. It also offers to set up pre-commit hooks and Claude Code integration.

## What It Generates

| File | Purpose |
|------|---------|
| `viberails.config.json` | Detected stack, conventions, boundary rules, and rule thresholds |
| `.viberails/context.md` | AI context in natural language — enforced rules your AI tools can read |
| `.viberails/scan-result.json` | Raw scan data (gitignored) |

## Commands

### `npx viberails` (or `viberails init`)

Scans your project, generates config and context files, and guides you through hook setup.

- `--yes` / `-y` — Non-interactive mode. Uses defaults, includes only high-confidence conventions. Skips hook installation.
- `--force` / `-f` — Re-initialize from scratch, replacing the existing config. Use this when your project has changed significantly since the first init.

### `viberails sync`

Re-scans your project and regenerates context files. Preserves any manual edits to `viberails.config.json`. Reports specific changes: new stack detections, conventions, packages, and codebase size deltas.

### `viberails check`

Validates your project against the configured rules.

- `--staged` — Check only staged files (used by the pre-commit hook).

**Checks:** file size limits, naming conventions, missing tests, and import boundary violations.

### `viberails fix`

Auto-fixes naming violations and generates missing test stubs.

- `--dry-run` — Preview changes without applying them.
- `--rule file-naming` — Fix only specific rule types.
- `--yes` / `-y` — Apply fixes without confirmation.

### `viberails boundaries`

Displays configured boundary rules and detected violations.

- `--infer` — Infer boundary rules from existing import patterns.

## How It Works

1. **Scan** — Reads `package.json` to detect your framework, language, styling, and tooling. Walks your directory tree to map structure and analyze naming conventions.

2. **Detect** — Each convention gets a confidence level based on consistency across your codebase. For monorepos, import boundaries are inferred from existing dependency patterns.

3. **Generate** — Produces `viberails.config.json` with detected rules and `.viberails/context.md` with enforced rules in natural language.

4. **Enforce** — Optional pre-commit hooks and Claude Code integration run `viberails check` automatically, catching violations before they land.

## Hooks & Integrations

In interactive mode (`viberails init`), you can choose which integrations to set up:

### Pre-commit hook

Automatically detects your hook manager and integrates:

- **Lefthook** — Appends a `viberails` command to `lefthook.yml`
- **Husky** — Adds to `.husky/pre-commit`
- **No hook manager** — Creates `.git/hooks/pre-commit` directly

The hook runs `viberails check --staged` on every commit. It uses warn-only mode by default — set `"enforcement": "enforce"` in `viberails.config.json` to block commits with violations.

### Claude Code hook

Sets up a PostToolUse hook in `.claude/settings.json` that runs `viberails check` after every file edit or write, giving AI agents real-time feedback on convention violations.

> **Note:** `--yes` mode skips all hook installation. Run `viberails init` interactively to set up hooks, or configure them manually.

## Confidence Model

| Level | Consistency | Behavior |
|-------|-------------|----------|
| High | ≥ 90% | Included and enforced by default |
| Medium | 70–89% | Included as suggestion, not enforced |
| Low | < 70% | Omitted entirely |

In `--yes` mode, only high-confidence conventions are included.

## Programmatic API

Each package can be used independently:

```typescript
import { scan } from '@viberails/scanner';
import { generateConfig } from '@viberails/config';
import { generateContext } from '@viberails/context';

const result = await scan('./my-project');
const config = generateConfig(result);
const context = generateContext(config);
```

## Contributing

See [CHANGELOG.md](./CHANGELOG.md) for version history.

Issues and pull requests welcome at [github.com/Ceveos/viberails](https://github.com/Ceveos/viberails).

## License

MIT
