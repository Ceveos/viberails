/** A boundary rule defining allowed or disallowed imports. */
export interface BoundaryRule {
  /** Source package or directory pattern. */
  from: string;

  /** Target package or directory pattern. */
  to: string;

  /** Whether this import direction is allowed (`true`) or disallowed (`false`). */
  allow: boolean;

  /** Human-readable explanation of why this boundary exists. */
  reason?: string;
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
