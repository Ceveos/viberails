import { access } from 'node:fs/promises';
import { join } from 'node:path';
import type { DetectedStack, StackItem } from '@viberails/types';
import {
  BACKEND_MAPPINGS,
  FRAMEWORK_MAPPINGS,
  LIBRARY_MAPPINGS,
  LOCK_FILE_MAP,
  ORM_MAPPINGS,
  STYLING_MAPPINGS,
} from './stack-mappings.js';
import { readPackageJson } from './utils/read-package-json.js';

/**
 * Extracts the major version number from a semver range string.
 *
 * @param range - A semver range such as `"^15.0.3"`, `"~2.1.0"`, or `"3.x"`.
 * @returns The major version string (e.g. `"15"`), or `undefined` if extraction fails.
 */
export function extractMajorVersion(range: string): string | undefined {
  const match = range.match(/(\d+)/);
  return match?.[1];
}

/** Check whether a file exists at the given path. */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Detects the technology stack of a project by reading its package.json
 * and checking for lock files and configuration files.
 *
 * When `additionalDeps` is provided, they are merged as a base layer
 * beneath the package's own deps. This allows monorepo root-level deps
 * (e.g. typescript, eslint) to be visible during per-package scanning.
 *
 * @param projectPath - Absolute path to the project root directory.
 * @param additionalDeps - Optional base dependencies merged under package deps.
 * @returns The detected technology stack.
 */
export async function detectStack(
  projectPath: string,
  additionalDeps?: Record<string, string>,
): Promise<DetectedStack> {
  const pkg = await readPackageJson(projectPath);
  const allDeps: Record<string, string> = {
    ...additionalDeps,
    ...pkg?.dependencies,
    ...pkg?.devDependencies,
  };

  const framework = detectFramework(allDeps);
  const language = await detectLanguage(projectPath, allDeps);
  const styling = detectFirst(allDeps, STYLING_MAPPINGS);
  const backend = detectFirst(allDeps, BACKEND_MAPPINGS);
  const orm = detectFirst(allDeps, ORM_MAPPINGS);
  const packageManager = await detectPackageManager(projectPath);
  const linter = detectLinter(allDeps);
  const formatter = detectFormatter(allDeps);
  const testRunner = detectTestRunner(allDeps);
  const libraries = detectLibraries(allDeps);

  return {
    ...(framework && { framework }),
    language,
    ...(styling && { styling }),
    ...(backend && { backend }),
    ...(orm && { orm }),
    packageManager,
    ...(linter && { linter }),
    ...(formatter && { formatter }),
    ...(testRunner && { testRunner }),
    libraries,
  };
}

// ---------------------------------------------------------------------------
// Individual detectors
// ---------------------------------------------------------------------------

function detectFramework(allDeps: Record<string, string>): StackItem | undefined {
  for (const mapping of FRAMEWORK_MAPPINGS) {
    if (!(mapping.dep in allDeps)) continue;
    if (mapping.excludeDeps?.some((dep) => dep in allDeps)) continue;
    return {
      name: mapping.name,
      version: extractMajorVersion(allDeps[mapping.dep]),
    };
  }
  return undefined;
}

async function detectLanguage(
  projectPath: string,
  allDeps: Record<string, string>,
): Promise<StackItem> {
  if ('typescript' in allDeps) {
    return {
      name: 'typescript',
      version: extractMajorVersion(allDeps.typescript),
    };
  }
  if (await fileExists(join(projectPath, 'tsconfig.json'))) {
    return { name: 'typescript' };
  }
  return { name: 'javascript' };
}

function detectFirst(
  allDeps: Record<string, string>,
  mappings: Array<{ dep: string; name: string }>,
): StackItem | undefined {
  for (const mapping of mappings) {
    if (mapping.dep in allDeps) {
      return {
        name: mapping.name,
        version: extractMajorVersion(allDeps[mapping.dep]),
      };
    }
  }
  return undefined;
}

async function detectPackageManager(projectPath: string): Promise<StackItem> {
  for (const entry of LOCK_FILE_MAP) {
    if (await fileExists(join(projectPath, entry.file))) {
      return { name: entry.name };
    }
  }
  return { name: 'npm' };
}

function detectLinter(allDeps: Record<string, string>): StackItem | undefined {
  if ('eslint' in allDeps) {
    return { name: 'eslint', version: extractMajorVersion(allDeps.eslint) };
  }
  if ('@biomejs/biome' in allDeps) {
    return {
      name: 'biome',
      version: extractMajorVersion(allDeps['@biomejs/biome']),
    };
  }
  return undefined;
}

function detectFormatter(allDeps: Record<string, string>): StackItem | undefined {
  if ('prettier' in allDeps) {
    return { name: 'prettier', version: extractMajorVersion(allDeps.prettier) };
  }
  if ('@biomejs/biome' in allDeps) {
    return {
      name: 'biome',
      version: extractMajorVersion(allDeps['@biomejs/biome']),
    };
  }
  return undefined;
}

function detectTestRunner(allDeps: Record<string, string>): StackItem | undefined {
  if ('vitest' in allDeps) {
    return { name: 'vitest', version: extractMajorVersion(allDeps.vitest) };
  }
  if ('jest' in allDeps) {
    return { name: 'jest', version: extractMajorVersion(allDeps.jest) };
  }
  if ('@playwright/test' in allDeps) {
    return { name: 'playwright', version: extractMajorVersion(allDeps['@playwright/test']) };
  }
  if ('cypress' in allDeps) {
    return { name: 'cypress', version: extractMajorVersion(allDeps.cypress) };
  }
  if ('mocha' in allDeps) {
    return { name: 'mocha', version: extractMajorVersion(allDeps.mocha) };
  }
  return undefined;
}

function detectLibraries(allDeps: Record<string, string>): StackItem[] {
  const libs: StackItem[] = [];
  for (const mapping of LIBRARY_MAPPINGS) {
    const found = mapping.deps.find((dep) => dep in allDeps);
    if (found) {
      libs.push({
        name: mapping.name,
        version: extractMajorVersion(allDeps[found]),
      });
    }
  }
  return libs;
}
