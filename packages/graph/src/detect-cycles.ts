/**
 * Detects import cycles in a directed graph of file dependencies.
 * Uses DFS with three-color marking (white/gray/black) to find back edges.
 *
 * @param edges - Array of directed edges with source and target file paths.
 * @returns Array of cycles, each represented as a list of file paths.
 */
export function detectCycles(edges: Array<{ source: string; target: string }>): string[][] {
  // Build adjacency list
  const graph = new Map<string, string[]>();
  const nodes = new Set<string>();

  for (const { source, target } of edges) {
    nodes.add(source);
    nodes.add(target);
    const neighbors = graph.get(source);
    if (neighbors) {
      neighbors.push(target);
    } else {
      graph.set(source, [target]);
    }
  }

  const WHITE = 0; // unvisited
  const GRAY = 1; // in current DFS path
  const BLACK = 2; // fully processed

  const color = new Map<string, number>();
  for (const node of nodes) {
    color.set(node, WHITE);
  }

  const cycles: string[][] = [];
  const path: string[] = [];

  function dfs(node: string): void {
    color.set(node, GRAY);
    path.push(node);

    const neighbors = graph.get(node) ?? [];
    for (const neighbor of neighbors) {
      const c = color.get(neighbor);

      if (c === GRAY) {
        // Found a cycle — extract it from the path
        const cycleStart = path.indexOf(neighbor);
        if (cycleStart !== -1) {
          cycles.push(path.slice(cycleStart));
        }
      } else if (c === WHITE) {
        dfs(neighbor);
      }
    }

    path.pop();
    color.set(node, BLACK);
  }

  for (const node of nodes) {
    if (color.get(node) === WHITE) {
      dfs(node);
    }
  }

  return cycles;
}
