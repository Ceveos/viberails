export const VERSION = '0.1.0';

export type { Confidence, DetectedConvention } from './confidence.js';
export { confidenceFromConsistency } from './confidence.js';

export type {
  ScanResult,
  DetectedStack,
  StackItem,
  DetectedStructure,
  DirectoryInfo,
  DirectoryRole,
  CodebaseStatistics,
  FileStatistic,
} from './scan-result.js';

export type {
  ViberailsConfig,
  ConfigStack,
  ConfigStructure,
  ConfigConventions,
  ConventionValue,
  ConfigRules,
} from './config.js';
