import type {
  BoundaryConfig,
  BoundaryViolation,
  ImportGraph,
  ImportGraphNode,
} from '@viberails/types';

/**
 * Checks import edges against boundary rules and returns violations.
 *
 * For each edge in the graph, determines the source and target
 * package/directory and checks if any deny rule matches.
 * Skips external/builtin imports, same-package/directory edges,
 * and files listed in the ignore list.
 *
 * @param graph - The complete import graph for a project.
 * @param boundaries - Boundary config with deny map and optional ignore list.
 * @returns An array of boundary violations.
 */
export function checkBoundaries(
  graph: ImportGraph,
  boundaries: BoundaryConfig,
): BoundaryViolation[] {
  const denyMap = boundaries.deny;
  if (Object.keys(denyMap).length === 0) return [];

  const isMonorepo = graph.packages.length > 0;
  const nodeIndex = buildNodeIndex(graph.nodes);

  // Build ignored file set for quick lookup
  const ignoredFiles = new Set(boundaries.ignore ?? []);

  // Build package path → package name lookup for workspace imports
  const packagePathIndex = new Map<string, string>();
  for (const pkg of graph.packages) {
    packagePathIndex.set(pkg.path, pkg.name);
  }

  const violations: BoundaryViolation[] = [];

  for (const edge of graph.edges) {
    // Skip external/builtin targets (not absolute paths)
    if (!edge.target.startsWith('/')) continue;

    const sourceNode = nodeIndex.get(edge.source);
    if (!sourceNode) continue;

    // Skip files in the ignore list
    if (ignoredFiles.has(sourceNode.relativePath)) continue;

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

    // Check deny map
    const deniedTargets = denyMap[sourceZone];
    if (deniedTargets?.includes(targetZone)) {
      violations.push({
        file: edge.source,
        line: edge.line,
        specifier: edge.specifier,
        resolvedTo: edge.target,
        rule: { from: sourceZone, to: targetZone },
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
