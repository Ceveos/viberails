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

viberails scans your project, generates config and context files, and installs a pre-commit hook.

## What It Generates

| File | Purpose |
|------|---------|
| `viberails.config.json` | Detected stack, conventions, boundary rules, and rule thresholds |
| `.viberails/context.md` | AI context in natural language — enforced rules your AI tools can read |
| `.viberails/scan-result.json` | Raw scan data (gitignored) |

viberails also installs a pre-commit hook that runs `viberails check --staged` automatically.

## Commands

### `npx viberails` (or `viberails init`)

Scans your project, generates config and context files, and sets up a pre-commit hook.

- `--yes` / `-y` — Non-interactive mode. Uses defaults, includes only high-confidence conventions.

### `viberails sync`

Re-scans your project and regenerates context files. Preserves any manual edits to `viberails.config.json`.

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

4. **Enforce** — A pre-commit hook runs `viberails check --staged` on every commit, catching violations before they land.

## Pre-commit Hooks

`viberails init` automatically detects your hook manager and integrates:

- **Lefthook** — Appends a `viberails` command to `lefthook.yml`
- **Husky** — Adds to `.husky/pre-commit`
- **No hook manager** — Creates `.git/hooks/pre-commit` directly

The hook runs in warn-only mode by default. Set `"enforcement": "enforce"` in `viberails.config.json` to block commits with violations.

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
