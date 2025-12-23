export type DependencyGraph = Record<string, Set<string>>;

export function topologicalSort(graph: DependencyGraph) {
  const sortedNodes: Array<string> = [];
  const activeNodes: Array<string> = [];

  const ids = Object.keys(graph);

  for (const [key, set] of Object.entries(graph)) if (set.size === 0) activeNodes.push(key);

  while (activeNodes.length > 0) {
    const currentNode = activeNodes.pop()!;
    sortedNodes.push(currentNode);

    for (const id of ids) {
      const parents = graph[id];

      if (!parents.has(currentNode)) continue;

      parents.delete(currentNode);

      if (parents.size === 0) activeNodes.push(id);
    }

  }

  if (Object.values(graph).some((parents) => parents.size > 0)) throw new Error("Dependency graph has cycle");

  return sortedNodes;
}
