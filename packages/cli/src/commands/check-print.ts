import type { CheckViolation } from '@viberails/types';
import chalk from 'chalk';

/**
 * Print violations grouped by rule type with counts.
 */
export function printGroupedViolations(violations: CheckViolation[], limit?: number): void {
  const groups = new Map<string, CheckViolation[]>();
  for (const v of violations) {
    const existing = groups.get(v.rule) ?? [];
    existing.push(v);
    groups.set(v.rule, existing);
  }

  const ruleOrder = [
    'file-size',
    'file-naming',
    'missing-test',
    'test-coverage',
    'boundary-violation',
  ];
  const sortedKeys = [...groups.keys()].sort(
    (a, b) =>
      (ruleOrder.indexOf(a) === -1 ? 99 : ruleOrder.indexOf(a)) -
      (ruleOrder.indexOf(b) === -1 ? 99 : ruleOrder.indexOf(b)),
  );

  let totalShown = 0;
  const totalLimit = limit ?? Number.POSITIVE_INFINITY;

  for (const rule of sortedKeys) {
    const group = groups.get(rule);
    if (!group) continue;
    const remaining = totalLimit - totalShown;
    if (remaining <= 0) break;

    const toShow = group.slice(0, remaining);
    const hidden = group.length - toShow.length;

    for (const v of toShow) {
      const icon = v.severity === 'error' ? chalk.red('✗') : chalk.yellow('!');
      console.log(`${icon} ${chalk.dim(v.rule)} ${v.file}: ${v.message}`);
    }
    totalShown += toShow.length;

    if (hidden > 0) {
      console.log(chalk.dim(`  ... and ${hidden} more ${rule} violations`));
    }
  }
}

/**
 * Print a summary of violations by rule type.
 */
export function printSummary(violations: CheckViolation[]): void {
  const counts = new Map<string, number>();
  for (const v of violations) {
    counts.set(v.rule, (counts.get(v.rule) ?? 0) + 1);
  }

  const word = violations.length === 1 ? 'violation' : 'violations';
  const parts = [...counts.entries()].map(([rule, count]) => `${count} ${rule}`);
  console.log(`\n${violations.length} ${word} found (${parts.join(', ')}).`);
}
