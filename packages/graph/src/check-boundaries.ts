import type {
  BoundaryRule,
  BoundaryViolation,
  ImportGraph,
  ImportGraphNode,
} from '@viberails/types';

/**
 * Checks import edges against boundary rules and returns violations.
 *
 * For each edge in the graph, determines the source and target
 * package/directory and checks if any `allow: false` rule matches.
 * Skips external/builtin imports and same-package/directory edges.
 *
 * @param graph - The complete import graph for a project.
 * @param rules - Boundary rules to check against.
 * @returns An array of boundary violations.
 */
export function checkBoundaries(graph: ImportGraph, rules: BoundaryRule[]): BoundaryViolation[] {
  if (rules.length === 0) return [];

  const isMonorepo = graph.packages.length > 0;
  const nodeIndex = buildNodeIndex(graph.nodes);

  // Build package path → package name lookup for workspace imports
  // (workspace imports resolve to the package root path, not a file)
  const packagePathIndex = new Map<string, string>();
  for (const pkg of graph.packages) {
    packagePathIndex.set(pkg.path, pkg.name);
  }

  const denyRules = rules.filter((r) => !r.allow);
  const allowRules = rules.filter((r) => r.allow);

  const violations: BoundaryViolation[] = [];

  for (const edge of graph.edges) {
    // Skip external/builtin targets (not absolute paths)
    if (!edge.target.startsWith('/')) continue;

    const sourceNode = nodeIndex.get(edge.source);
    if (!sourceNode) continue;

    // Determine target zone: try node lookup first, then package path lookup
    const targetNode = nodeIndex.get(edge.target);
    let targetZone: string | undefined;
    if (isMonorepo) {
      targetZone = targetNode?.packageName ?? packagePathIndex.get(edge.target);
    } else {
      if (targetNode) {
        targetZone = getTopLevelDirectory(targetNode.relativePath);
      }
    }

    const sourceZone = isMonorepo
      ? sourceNode.packageName
      : getTopLevelDirectory(sourceNode.relativePath);

    // Skip if we can't determine zones or they're the same
    if (!sourceZone || !targetZone || sourceZone === targetZone) continue;

    // Check if explicitly allowed
    const isAllowed = allowRules.some((r) => r.from === sourceZone && r.to === targetZone);
    if (isAllowed) continue;

    // Check deny rules
    const matchedRule = denyRules.find((r) => r.from === sourceZone && r.to === targetZone);
    if (matchedRule) {
      violations.push({
        file: edge.source,
        line: edge.line,
        specifier: edge.specifier,
        resolvedTo: edge.target,
        rule: matchedRule,
      });
    }
  }

  return violations;
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
 * Extract the top-level directory for a file's relative path.
 * Same logic as infer-boundaries — strips src/ prefix.
 */
function getTopLevelDirectory(relativePath: string): string | undefined {
  const normalized = relativePath.startsWith('src/') ? relativePath.slice(4) : relativePath;
  const slashIndex = normalized.indexOf('/');
  if (slashIndex === -1) return undefined;
  return normalized.slice(0, slashIndex);
}
