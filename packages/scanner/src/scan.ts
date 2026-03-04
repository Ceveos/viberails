import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { ScanResult } from '@viberails/types';
import { computeStatistics } from './compute-statistics.js';
import { detectConventions } from './detect-conventions.js';
import { detectStack } from './detect-stack.js';
import { detectStructure } from './detect-structure.js';

/**
 * Options for the scan function.
 */
export interface ScanOptions {
  // Reserved for future use (e.g. specific scanners to skip, paths to ignore)
}

/**
 * Scans a project directory and returns a comprehensive analysis of its
 * stack, structure, conventions, and statistics.
 *
 * This is the primary entry point for the scanner package. It composes
 * all individual detection functions into a unified ScanResult.
 *
 * @param projectPath - Absolute or relative path to the project root.
 * @param options - Optional scan configuration.
 * @returns Complete scan result for the project.
 * @throws If the project path does not exist.
 */
export async function scan(projectPath: string, options?: ScanOptions): Promise<ScanResult> {
  const root = resolve(projectPath);

  // Validate that the path exists
  try {
    await access(root);
  } catch {
    throw new Error(`Project path does not exist: ${root}`);
  }

  // Run independent detectors in parallel
  const [stack, structure, statistics] = await Promise.all([
    detectStack(root),
    detectStructure(root),
    computeStatistics(root),
  ]);

  // detectConventions depends on structure result
  const conventions = await detectConventions(root, structure);

  return {
    root,
    stack,
    structure,
    conventions,
    statistics,
  };
}
