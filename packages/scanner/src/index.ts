export const VERSION = '0.1.0';

export { computeStatistics } from './compute-statistics.js';
export { detectConventions } from './detect-conventions.js';
export { detectStack, extractMajorVersion } from './detect-stack.js';
export { detectStructure } from './detect-structure.js';
export type { ScanOptions } from './scan.js';
export { scan } from './scan.js';
export type { PackageJson } from './utils/read-package-json.js';
export { readPackageJson } from './utils/read-package-json.js';
export type { WalkedDirectory } from './utils/walk-directory.js';
export { walkDirectory } from './utils/walk-directory.js';
