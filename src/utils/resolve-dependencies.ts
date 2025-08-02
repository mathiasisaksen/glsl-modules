
import { GLSLLibrary } from "../core-system/glsl-library.js";
import { ModuleEntity } from "../core-system/module-content/index.js";


// TODO make more efficient, now it resolves the same dependencies multiple times
export function resolveDependencies(entities: ModuleEntity[], libraries: Record<string, GLSLLibrary>) {
  
  let resolvedEntities: ModuleEntity[] = [];

  const seenIds = new Set<string>(entities.map(({ id }) => id));
  
  for (const entity of entities) {
    for (const { path, id, name, type } of entity.dependencies) {
      if (seenIds.has(id)) continue;

      const libraryName = GLSLLibrary.extractLibraryNameFromPath(path);
      
      const library = libraries[libraryName];
      
      if (!library) throw new Error(`Library ${libraryName} missing`);

      const importedEntities = library.getEntity(path, name, type, entity.id);

      resolvedEntities.push(...importedEntities);
      
      for (const entity of importedEntities) {
        const dependencies = library.resolveDependencies(entity, seenIds);
        resolvedEntities.push(...dependencies);
      }
    }
  }
  return resolvedEntities;
}