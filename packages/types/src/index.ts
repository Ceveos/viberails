export const VERSION = '0.1.0';

export type { CheckResult, CheckRule, CheckViolation } from './check-result.js';
export type { Confidence, DetectedConvention } from './confidence.js';
export { confidenceFromConsistency } from './confidence.js';
export type {
  ConfigConventions,
  ConfigRules,
  ConfigStack,
  ConfigStructure,
  ConventionValue,
  ViberailsConfig,
} from './config.js';
export {
  FRAMEWORK_NAMES,
  LIBRARY_NAMES,
  ROLE_DESCRIPTIONS,
  STYLING_NAMES,
} from './display-names.js';
export type {
  CodebaseStatistics,
  DetectedStack,
  DetectedStructure,
  DirectoryInfo,
  DirectoryRole,
  FileStatistic,
  ScanResult,
  StackItem,
} from './scan-result.js';
