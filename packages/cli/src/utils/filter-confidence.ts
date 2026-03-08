import type { ConfigConventions } from '@viberails/types';

/**
 * Filter conventions to only include high-confidence entries (using _meta).
 * Used in --yes mode to avoid enforcing uncertain detections.
 */
export function filterHighConfidence(
  conventions: ConfigConventions,
  meta?: Record<string, { confidence: string }>,
): ConfigConventions {
  if (!meta) return conventions;
  const filtered: ConfigConventions = {};
  for (const [key, value] of Object.entries(conventions)) {
    if (value === undefined) continue;
    const convMeta = meta[key];
    if (!convMeta || convMeta.confidence === 'high') {
      filtered[key as keyof ConfigConventions] = value;
    }
  }
  return filtered;
}
