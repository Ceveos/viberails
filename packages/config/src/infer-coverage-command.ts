/**
 * Infer a coverage command from the detected test runner string.
 *
 * Used during `init` to store the inferred command in config so that
 * `check` can use it explicitly. Does not verify binary availability —
 * the command is stored as a suggestion for the user to review.
 *
 * @param testRunner - Test runner string from config (e.g. "vitest@4", "jest@29")
 * @returns Shell command string, or undefined if the runner is unsupported
 */
export function inferCoverageCommand(testRunner: string | undefined): string | undefined {
  if (!testRunner) return undefined;
  const runner = testRunner.split('@')[0];
  if (runner === 'vitest') {
    return 'npx vitest run --coverage --coverage.reporter=json-summary';
  }
  if (runner === 'jest') {
    return 'npx jest --coverage --coverageReporters=json-summary';
  }
  return undefined;
}
