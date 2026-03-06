export const VERSION = '0.1.0';

export { scan } from './scan.js';
export type { ScanOptions } from './scan.js';
export { detectStack, extractMajorVersion } from './detect-stack.js';
export { detectStructure } from './detect-structure.js';
export { detectConventions } from './detect-conventions.js';
export { computeStatistics } from './compute-statistics.js';
export type { PackageJson } from './utils/read-package-json.js';
export { readPackageJson } from './utils/read-package-json.js';
export type { WalkedDirectory } from './utils/walk-directory.js';
export { walkDirectory } from './utils/walk-directory.js';
