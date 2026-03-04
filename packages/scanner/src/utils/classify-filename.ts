/**
 * Naming convention types for filenames.
 */
export type FilenameConvention =
  | 'kebab-case'
  | 'camelCase'
  | 'PascalCase'
  | 'snake_case'
  | 'unknown';

const PATTERNS = [
  { convention: 'PascalCase', regex: /^[A-Z][a-zA-Z0-9]*$/ },
  { convention: 'camelCase', regex: /^[a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*$/ },
  { convention: 'kebab-case', regex: /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/ },
  { convention: 'snake_case', regex: /^[a-z][a-z0-9]*(_[a-z0-9]+)+$/ },
] as const;

/**
 * Classifies a filename (without extension) into a naming convention.
 *
 * Single lowercase words like 'utils' return 'unknown' because they are
 * ambiguous — they could be kebab-case, snake_case, or camelCase without
 * a disambiguating structural marker.
 *
 * @param filename - The bare filename with no extension (e.g. 'user-profile').
 * @returns The detected naming convention, or 'unknown' if ambiguous.
 */
export function classifyFilename(filename: string): FilenameConvention {
  for (const { convention, regex } of PATTERNS) {
    if (regex.test(filename)) return convention;
  }
  return 'unknown';
}
