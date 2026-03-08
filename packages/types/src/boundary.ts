/**
 * Boundary configuration for import enforcement.
 * Maps source packages/directories to the targets they must NOT import from.
 */
export interface BoundaryConfig {
  /** Source → denied targets. Each key is a package/directory name, value is the list it must not import from. */
  deny: Record<string, string[]>;

  /** File paths that bypass boundary checks entirely (escape hatch for legitimate exceptions). */
  ignore?: string[];
}

/** A single boundary rule (from → to deny pair), used internally by violation reporting. */
export interface BoundaryRule {
  /** Source package or directory. */
  from: string;

  /** Target package or directory that is denied. */
  to: string;
}

/** A boundary violation detected during checking. */
export interface BoundaryViolation {
  /** File containing the violating import. */
  file: string;

  /** Line number of the violating import. */
  line: number;

  /** The import specifier that violated the boundary. */
  specifier: string;

  /** What the specifier resolved to. */
  resolvedTo: string;

  /** The boundary rule that was violated. */
  rule: BoundaryRule;
}
