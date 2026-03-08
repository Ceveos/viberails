declare const __PACKAGE_VERSION__: string;
export const VERSION: string = __PACKAGE_VERSION__;

export {
  aggregateConventions,
  aggregateStacks,
  aggregateStatistics,
  aggregateStructures,
} from './aggregate.js';
export { computeStatistics } from './compute-statistics.js';
export { detectConventions } from './detect-conventions.js';
export { detectStack, extractMajorVersion } from './detect-stack.js';
export { detectStructure } from './detect-structure.js';
export { detectTypesOnly } from './detect-types-only.js';
export { detectWorkspace } from './detect-workspace.js';
export type { ScanOptions } from './scan.js';
export { scan } from './scan.js';
export { scanPackage } from './scan-package.js';
export type { PackageJson } from './utils/read-package-json.js';
export { readPackageJson } from './utils/read-package-json.js';
export type { WalkedDirectory } from './utils/walk-directory.js';
export { walkDirectory } from './utils/walk-directory.js';
