# viberails enforced rules

These rules are checked before commits. Violations will be **warned** but not blocked:

- Files must not exceed **300 lines**. Split into focused modules.
- Functions must not exceed **50 lines**. Extract helpers for complex logic.
- Every source file in `src/` must have a corresponding `*.test.ts` file.

## Boundary rules

These import boundaries are enforced:

- `@viberails/types` must NOT import from `@viberails/scanner` (@viberails/types should not depend on @viberails/scanner)
- `@viberails/types` must NOT import from `@viberails/config` (@viberails/types should not depend on @viberails/config)
- `@viberails/types` must NOT import from `@viberails/context` (@viberails/types should not depend on @viberails/context)
- `@viberails/types` must NOT import from `@viberails/graph` (@viberails/types should not depend on @viberails/graph)
- `@viberails/types` must NOT import from `viberails` (@viberails/types should not depend on viberails)
- `@viberails/scanner` must NOT import from `@viberails/config` (@viberails/scanner should not depend on @viberails/config)
- `@viberails/scanner` must NOT import from `@viberails/context` (@viberails/scanner should not depend on @viberails/context)
- `@viberails/scanner` must NOT import from `@viberails/graph` (@viberails/scanner should not depend on @viberails/graph)
- `@viberails/scanner` must NOT import from `viberails` (@viberails/scanner should not depend on viberails)
- `@viberails/config` must NOT import from `@viberails/scanner` (@viberails/config should not depend on @viberails/scanner)
- `@viberails/config` must NOT import from `@viberails/context` (@viberails/config should not depend on @viberails/context)
- `@viberails/config` must NOT import from `@viberails/graph` (@viberails/config should not depend on @viberails/graph)
- `@viberails/config` must NOT import from `viberails` (@viberails/config should not depend on viberails)
- `@viberails/context` must NOT import from `@viberails/scanner` (@viberails/context should not depend on @viberails/scanner)
- `@viberails/context` must NOT import from `@viberails/graph` (@viberails/context should not depend on @viberails/graph)
- `@viberails/context` must NOT import from `viberails` (@viberails/context should not depend on viberails)
- `@viberails/graph` must NOT import from `@viberails/scanner` (@viberails/graph should not depend on @viberails/scanner)
- `@viberails/graph` must NOT import from `@viberails/config` (@viberails/graph should not depend on @viberails/config)
- `@viberails/graph` must NOT import from `@viberails/context` (@viberails/graph should not depend on @viberails/context)
- `@viberails/graph` must NOT import from `viberails` (@viberails/graph should not depend on viberails)

Run `viberails check` before committing to catch violations early.
