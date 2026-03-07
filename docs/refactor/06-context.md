# Phase 6: Context Generation with Per-Package Sections

## Goal

When the config has per-package overrides, the generated `context.md` should include a section describing per-package rule differences. AI agents working in `apps/mobile/` need to know that PascalCase applies there, not the global kebab-case.

## Prerequisites

Phase 5 (config) must be complete.

## File to Modify

### `packages/context/src/generate-context.ts`

**Current behavior:** Generates a flat list of enforced rules from the global config.

**New behavior:** After the global rules section, add a `## Per-package rules` section if `config.packages` has entries.

Add a new function:

```typescript
function formatPackageOverrides(config: ViberailsConfig): string[]
```

Logic:
1. If `!config.packages || config.packages.length === 0`, return `[]`
2. Start with `## Per-package rules\n`
3. Add explanatory line: `The following packages have rules that differ from the global defaults:\n`
4. For each package override:
   a. Header: `### {path}` (optionally include framework: `### apps/mobile (Expo)`)
   b. For each convention override: render the convention rule (reuse `NAMING_EXAMPLES`)
   c. For each rule override: render the rule difference

**Getting framework name for display:**

```typescript
function packageHeader(pkg: PackageConfigOverrides): string {
  const framework = pkg.stack?.framework;
  if (framework) {
    // Parse "expo@53" → "Expo" using FRAMEWORK_NAMES or title-casing
    const name = framework.split('@')[0];
    return `### ${pkg.path} (${name})`;
  }
  return `### ${pkg.path}`;
}
```

**Integration into `generateContext`:**

```typescript
export function generateContext(config: ViberailsConfig): string {
  // ... existing code ...

  // Add per-package overrides section
  const packageLines = formatPackageOverrides(config);
  if (packageLines.length > 0) {
    sections.push('');
    sections.push(packageLines.join('\n'));
  }

  // ... boundary rules (existing) ...
  // ... footer (existing) ...
}
```

## Example Output

For a monorepo with global kebab-case but mobile using PascalCase:

```markdown
# viberails enforced rules

These rules are checked before commits. Violations will be **warned** but not blocked:

- Files must not exceed **300 lines**. Split into focused modules.
- Functions must not exceed **50 lines**. Extract helpers for complex logic.
- Source files use **kebab-case**: `user-profile.ts`, not `UserProfile.ts`.

## Per-package rules

The following packages have rules that differ from the global defaults:

### apps/mobile (expo)
- Source files use **PascalCase**: `UserProfile.ts`, not `user-profile.ts`.

## Boundary rules

...
```

For single-package projects, the output is identical to today (no per-package section).

## New Tests

### `packages/context/src/generate-context.test.ts`

```typescript
describe('per-package rules', () => {
  it('omits per-package section when no package overrides', () => {
    const result = generateContext(configWithoutPackages);
    expect(result).not.toContain('Per-package rules');
  });

  it('includes per-package section with convention override', () => {
    const config = {
      ...baseConfig,
      packages: [{
        name: '@app/mobile',
        path: 'apps/mobile',
        stack: { framework: 'expo@53' },
        conventions: { fileNaming: 'PascalCase' },
      }],
    };
    const result = generateContext(config);
    expect(result).toContain('## Per-package rules');
    expect(result).toContain('### apps/mobile (expo)');
    expect(result).toContain('**PascalCase**');
  });

  it('does not include per-package section for empty overrides array', () => {
    const config = { ...baseConfig, packages: [] };
    const result = generateContext(config);
    expect(result).not.toContain('Per-package rules');
  });
});
```

## Verification

```bash
pnpm --filter @viberails/context test  # all tests pass
pnpm test                              # full suite
```
