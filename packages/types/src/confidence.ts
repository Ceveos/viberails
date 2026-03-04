/**
 * Confidence level for a detected convention or pattern.
 *
 * - `'high'` — ≥90% consistency across analyzed files. Enforced by default.
 * - `'medium'` — 70–89% consistency. Included in config but not enforced.
 * - `'low'` — <70% consistency. Omitted from config entirely.
 */
export type Confidence = 'high' | 'medium' | 'low';

/**
 * A convention or pattern detected by the scanner, with metadata
 * about how confidently it was identified.
 *
 * @typeParam T - The type of the detected value. Defaults to `string`.
 */
export interface DetectedConvention<T = string> {
  /** The detected value (e.g. a naming pattern, file extension, or path). */
  value: T;

  /** How confident the scanner is in this detection. */
  confidence: Confidence;

  /** Number of files analyzed to determine this convention. */
  sampleSize: number;

  /** Percentage (0–100) of files that follow this convention. */
  consistency: number;
}

/**
 * Derives a confidence level from a consistency percentage.
 *
 * @param consistency - A number from 0 to 100 representing the percentage
 *   of files that follow a given convention.
 * @returns The corresponding confidence level:
 *   - `'high'` for consistency ≥ 90
 *   - `'medium'` for consistency ≥ 70 and < 90
 *   - `'low'` for consistency < 70
 */
export function confidenceFromConsistency(consistency: number): Confidence {
  if (consistency >= 90) return 'high';
  if (consistency >= 70) return 'medium';
  return 'low';
}
