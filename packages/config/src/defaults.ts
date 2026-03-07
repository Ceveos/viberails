import type { ConfigRules } from '@viberails/types';

/**
 * Default rule thresholds and toggles for a new viberails config.
 * These values are intentionally conservative to build trust on first run.
 */
export const DEFAULT_RULES: ConfigRules = {
  maxFileLines: 300,
  maxTestFileLines: 0,
  maxFunctionLines: 50,
  requireTests: true,
  enforceNaming: true,
  enforceBoundaries: false,
};

/**
 * Default glob patterns for files and directories to ignore.
 */
export const DEFAULT_IGNORE: string[] = [
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
