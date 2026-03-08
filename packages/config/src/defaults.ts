import type { ConfigRules } from '@viberails/types';

/**
 * Default rule thresholds and toggles for a new viberails config.
 * These values are intentionally conservative to build trust on first run.
 */
export const DEFAULT_RULES: ConfigRules = {
  maxFileLines: 300,
  maxTestFileLines: 0,
  testCoverage: 80,
  enforceNaming: true,
  enforceBoundaries: false,
  enforceMissingTests: true,
};

/**
 * Default project-specific ignore patterns for a new config.
 * Empty — universal patterns live in BUILTIN_IGNORE and are applied at check-time.
 */
export const DEFAULT_IGNORE: string[] = [];

/**
 * Universal ignore patterns applied at check-time.
 * These are never written to config — they are always applied implicitly.
 */
export const BUILTIN_IGNORE: string[] = [
  '**/*.d.ts',
  '**/*.min.js',
  '**/*.min.cjs',
  '**/*.umd.js',
  '**/*.bundle.js',
  'dist/**',
  'node_modules/**',
  'build/**',
  '.next/**',
  '.expo/**',
  '.output/**',
  '.svelte-kit/**',
  '.turbo/**',
  'coverage/**',
  '**/public/**',
  '**/vendor/**',
  '.viberails/**',
  '**/generated/**',
  '**/__generated__/**',
];
