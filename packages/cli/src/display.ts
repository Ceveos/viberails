import chalk from 'chalk';
import type { DetectedConvention, ScanResult, StackItem } from '@viberails/types';

/** Display names for framework identifiers. */
const FRAMEWORK_NAMES: Record<string, string> = {
  nextjs: 'Next.js',
  remix: 'Remix',
  nuxt: 'Nuxt',
  sveltekit: 'SvelteKit',
  astro: 'Astro',
  vite: 'Vite',
  gatsby: 'Gatsby',
  express: 'Express',
  fastify: 'Fastify',
};

/** Display names for styling libraries. */
const STYLING_NAMES: Record<string, string> = {
  tailwindcss: 'Tailwind CSS',
  'css-modules': 'CSS Modules',
  'styled-components': 'styled-components',
};

/** Labels for convention keys. */
const CONVENTION_LABELS: Record<string, string> = {
  fileNaming: 'File naming',
  componentNaming: 'Component naming',
  hookNaming: 'Hook naming',
  importAlias: 'Import alias',
};

/**
 * Format a StackItem for display: "DisplayName Version".
 */
function formatItem(item: StackItem, nameMap?: Record<string, string>): string {
  const name = nameMap?.[item.name] ?? item.name;
  return item.version ? `${name} ${item.version}` : name;
}

/**
 * Format a confidence label for display.
 */
function confidenceLabel(convention: DetectedConvention): string {
  const pct = Math.round(convention.consistency);
  if (convention.confidence === 'high') {
    return `${pct}% — high confidence, will enforce`;
  }
  return `${pct}% — medium confidence, suggested only`;
}

/**
 * Display scan results to the console with confidence indicators.
 *
 * @param scanResult - The scan result to display
 */
export function displayScanResults(scanResult: ScanResult): void {
  const { stack, conventions } = scanResult;

  console.log('\n' + chalk.bold('Detected:'));

  if (stack.framework) {
    console.log(`  ${chalk.green('✓')} ${formatItem(stack.framework, FRAMEWORK_NAMES)}`);
  }
  console.log(`  ${chalk.green('✓')} ${formatItem(stack.language)}`);
  if (stack.styling) {
    console.log(`  ${chalk.green('✓')} ${formatItem(stack.styling, STYLING_NAMES)}`);
  }
  if (stack.backend) {
    console.log(`  ${chalk.green('✓')} ${formatItem(stack.backend, FRAMEWORK_NAMES)}`);
  }
  if (stack.linter) {
    console.log(`  ${chalk.green('✓')} ${formatItem(stack.linter)}`);
  }
  if (stack.testRunner) {
    console.log(`  ${chalk.green('✓')} ${formatItem(stack.testRunner)}`);
  }
  if (stack.packageManager) {
    console.log(`  ${chalk.green('✓')} ${formatItem(stack.packageManager)}`);
  }

  const conventionEntries = Object.entries(conventions);
  if (conventionEntries.length > 0) {
    console.log('\n' + chalk.bold('Conventions:'));
    for (const [key, convention] of conventionEntries) {
      if (convention.confidence === 'low') continue;
      const label = CONVENTION_LABELS[key] ?? key;
      const ind = convention.confidence === 'high' ? chalk.green('✓') : chalk.yellow('~');
      const detail = chalk.dim(`(${confidenceLabel(convention)})`);
      console.log(`  ${ind} ${label}: ${convention.value} ${detail}`);
    }
  }

  console.log('');
}
