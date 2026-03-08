/**
 * The type of rule that was violated.
 */
export type CheckRule =
  | 'file-size'
  | 'file-naming'
  | 'missing-test'
  | 'test-coverage'
  | 'boundary-violation';

/**
 * A single rule violation detected by `viberails check`.
 */
export interface CheckViolation {
  /** Relative path to the offending file. */
  file: string;

  /** Which rule was violated. */
  rule: CheckRule;

  /** Human-readable description of the violation. */
  message: string;

  /** Severity derived from CLI mode (warn vs enforce). */
  severity: 'error' | 'warn';
}

/**
 * The result of running `viberails check`.
 */
export interface CheckResult {
  /** All violations found. */
  violations: CheckViolation[];

  /** Number of files that were checked. */
  checkedFiles: number;
}
