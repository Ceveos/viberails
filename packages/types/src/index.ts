declare const __PACKAGE_VERSION__: string;
export const VERSION: string = __PACKAGE_VERSION__;

export type { BoundaryRule, BoundaryViolation } from './boundary.js';
export type { CheckResult, CheckRule, CheckViolation } from './check-result.js';
export type { Confidence, DetectedConvention } from './confidence.js';
export { confidenceFromConsistency } from './confidence.js';
export type {
  ConfigConventions,
  ConfigRules,
  ConfigStack,
  ConfigStructure,
  ConventionValue,
  PackageConfigOverrides,
  ViberailsConfig,
  WorkspaceConfig,
} from './config.js';
export {
  FRAMEWORK_NAMES,
  LIBRARY_NAMES,
  ROLE_DESCRIPTIONS,
  STYLING_NAMES,
} from './display-names.js';
export type {
  ImportEdge,
  ImportGraph,
  ImportGraphNode,
  ImportKind,
  WorkspacePackage,
} from './graph.js';
export type {
  CodebaseStatistics,
  DetectedStack,
  DetectedStructure,
  DetectedWorkspace,
  DirectoryInfo,
  DirectoryRole,
  FileStatistic,
  PackageScanResult,
  ScanResult,
  StackItem,
} from './scan-result.js';
