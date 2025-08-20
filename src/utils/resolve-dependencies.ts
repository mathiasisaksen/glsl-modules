
import { GLSLLibrary } from "../core-system/glsl-library.js";
import { EntityDependency, ModuleEntity } from "../core-system/module-content/index.js";

type DependencyStackEntry = { 
  dependency: EntityDependency;
  dependentId: string; 
  libraries: Record<string, GLSLLibrary>;
};

export function resolveDependencies(entities: ModuleEntity[], libraries: Record<string, GLSLLibrary>) {
  let resolvedEntities: ModuleEntity[] = [];

  const seenIds = new Set<string>();
  const stack: DependencyStackEntry[] = [];

  for (const entity of entities) {
    seenIds.add(entity.id);
    for (const dependency of entity.dependencies) stack.push({ dependency, dependentId: entity.id, libraries });
  }

  while (stack.length > 0) {
    const { dependency, dependentId, libraries } = stack.pop()!;

    const { path, id, name, type } = dependency;

    if (seenIds.has(id)) continue;

    seenIds.add(id);

    const activeLibrary = libraries[GLSLLibrary.extractLibraryNameFromPath(path)];

    const exportedEntities = activeLibrary.getEntity(path, name, type, dependentId);

    for (const entity of exportedEntities) {
      for (const dependency of entity.dependencies) stack.push({ dependency, dependentId: entity.id, libraries: activeLibrary.dependencies });
      resolvedEntities.push(entity);
    }
  }

  return resolvedEntities;
}