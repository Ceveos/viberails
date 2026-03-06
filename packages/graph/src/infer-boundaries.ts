import type { BoundaryRule, ImportGraph, ImportGraphNode } from '@viberails/types';

/**
 * Infers boundary rules from existing import patterns in the graph.
 *
 * For monorepos, creates package-level rules based on which packages
 * import from each other. For single-package projects, creates
 * directory-level rules based on top-level directory imports.
 *
 * Only creates `allow: false` rules where the codebase already follows
 * the pattern (zero imports in that direction), so inferred rules never
 * produce immediate violations.
 *
 * @param graph - The complete import graph for a project.
 * @returns An array of inferred boundary rules.
 */
export function inferBoundaries(graph: ImportGraph): BoundaryRule[] {
  if (graph.packages.length > 0) {
    return inferMonorepoBoundaries(graph);
  }
  return inferSinglePackageBoundaries(graph);
}

/**
 * Build a lookup from absolute file path to its graph node.
 */
function buildNodeIndex(nodes: ImportGraphNode[]): Map<string, ImportGraphNode> {
  const index = new Map<string, ImportGraphNode>();
  for (const node of nodes) {
    index.set(node.filePath, node);
  }
  return index;
}

/**
 * Infer boundary rules for a monorepo based on package-to-package imports.
 */
function inferMonorepoBoundaries(graph: ImportGraph): BoundaryRule[] {
  const nodeIndex = buildNodeIndex(graph.nodes);
  const packageNames = graph.packages.map((p) => p.name);

  // Build a set of declared internal dependencies per package
  const declaredDeps = new Map<string, Set<string>>();
  for (const pkg of graph.packages) {
    declaredDeps.set(pkg.name, new Set(pkg.internalDeps));
  }

  // Count imports from package A to package B
  const importCounts = new Map<string, number>();
  const key = (from: string, to: string) => `${from} -> ${to}`;

  for (const edge of graph.edges) {
    const sourceNode = nodeIndex.get(edge.source);
    const targetNode = nodeIndex.get(edge.target);
    if (!sourceNode?.packageName || !targetNode?.packageName) continue;
    if (sourceNode.packageName === targetNode.packageName) continue;

    const k = key(sourceNode.packageName, targetNode.packageName);
    importCounts.set(k, (importCounts.get(k) ?? 0) + 1);
  }

  const rules: BoundaryRule[] = [];

  for (const from of packageNames) {
    for (const to of packageNames) {
      if (from === to) continue;

      const count = importCounts.get(key(from, to)) ?? 0;
      const isDeclaredDep = declaredDeps.get(from)?.has(to) ?? false;

      if (count === 0 && !isDeclaredDep) {
        // No imports and not a declared dependency — disallow
        rules.push({
          from,
          to,
          allow: false,
          reason: `${from} should not depend on ${to}`,
        });
      } else if (count > 0 && isDeclaredDep) {
        // Imports exist and it's a declared dependency — allow
        rules.push({ from, to, allow: true });
      }
      // If imports exist but NOT declared → skip rule creation
      // (would produce immediate violation, defeats auto-detection purpose)
    }
  }

  return rules;
}

/**
 * Extract the top-level directory for a file's relative path.
 * e.g. "src/components/Button.tsx" → "components" (strips src/ prefix)
 *      "components/Button.tsx" → "components"
 *      "index.ts" → undefined (root-level file, no directory)
 */
function getTopLevelDirectory(relativePath: string): string | undefined {
  // Strip leading src/ prefix if present
  const normalized = relativePath.startsWith('src/') ? relativePath.slice(4) : relativePath;

  const slashIndex = normalized.indexOf('/');
  if (slashIndex === -1) return undefined;
  return normalized.slice(0, slashIndex);
}

/**
 * Infer boundary rules for a single-package project based on directory imports.
 */
function inferSinglePackageBoundaries(graph: ImportGraph): BoundaryRule[] {
  const nodeIndex = buildNodeIndex(graph.nodes);

  // Collect all top-level directories
  const directories = new Set<string>();
  for (const node of graph.nodes) {
    const dir = getTopLevelDirectory(node.relativePath);
    if (dir) directories.add(dir);
  }

  // Need at least 2 directories to form boundaries
  if (directories.size < 2) return [];

  // Count imports from directory A to directory B
  const importCounts = new Map<string, number>();
  const key = (from: string, to: string) => `${from} -> ${to}`;

  for (const edge of graph.edges) {
    const sourceNode = nodeIndex.get(edge.source);
    const targetNode = nodeIndex.get(edge.target);
    if (!sourceNode || !targetNode) continue;

    const sourceDir = getTopLevelDirectory(sourceNode.relativePath);
    const targetDir = getTopLevelDirectory(targetNode.relativePath);
    if (!sourceDir || !targetDir || sourceDir === targetDir) continue;

    const k = key(sourceDir, targetDir);
    importCounts.set(k, (importCounts.get(k) ?? 0) + 1);
  }

  const rules: BoundaryRule[] = [];
  const dirList = [...directories].sort();

  for (const from of dirList) {
    for (const to of dirList) {
      if (from === to) continue;

      const count = importCounts.get(key(from, to)) ?? 0;
      if (count === 0) {
        // No imports exist in this direction — safe to create a boundary
        rules.push({
          from,
          to,
          allow: false,
          reason: `${from} should not depend on ${to}`,
        });
      }
    }
  }

  return rules;
}
