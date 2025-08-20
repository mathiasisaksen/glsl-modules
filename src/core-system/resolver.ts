import { resolveDependencies } from "../utils/resolve-dependencies.js";
import { DependencyGraph, topologicalSort } from "../utils/topological-sort.js";
import { GLSLModule } from "./glsl-module.js";
import { ModuleEntity } from "./module-content/types.js";

export class Resolver {
  module: GLSLModule;

  allEntities: ModuleEntity[];
  idToEntityMap: Record<string, ModuleEntity[]>;

  constructor(module: GLSLModule) {
    this.module = module;

    const { entities, moduleContext } = module;

    // Create array of entities in module and all of the dependencies
    this.allEntities = entities
      .concat(resolveDependencies(entities, moduleContext.libraries));

    this.idToEntityMap = this.createIdToEntityMap();
  }

  createIdToEntityMap() {
    return this.allEntities.reduce<Record<string, ModuleEntity[]>>((map, entity) => {
      (map[entity.id] ??= []).push(entity);
      return map;
    }, {});
  }

  resolve() {
    const { allEntities } = this;

    const idToNewNameMap = this.createNameCollisionMap(allEntities);

    this.sortEntitiesByDependencyOrder();

    let resolvedCode =
      [this.module.unparsedCode.trim()]
        .concat(allEntities.map((entity) => entity.getResolvedDefinition(idToNewNameMap)))
        .join("\n\n")
        // Make code slightly more readable by removing excessive spacing
        .replace(/\n+\s*\n+/g, "\n\n");

    return resolvedCode;
  }

  // Creates graph that describes dependency structure of entities. 
  // The graph is represented as an object mapping each id to a set containing its dependencies
  createDependencyGraph() {
    const { allEntities, idToEntityMap } = this;
    const dependencyGraph: DependencyGraph = {};

    for (const entity of allEntities) {
      const dependencySet = dependencyGraph[entity.key] ??= new Set();
      for (const dependency of entity.dependencies) {
        // Get all entities that are potential dependencies 
        const candidateEntities = idToEntityMap[dependency.id];

        if (!candidateEntities) debugger

        for (const candidate of candidateEntities) {
          if (candidate.key === entity.key) continue;

          // If the candidate has entity as dependency, there is a 
          // dependency cycle -> only include candidates that come
          // before it in module
          const isCyclicDependency = candidate.dependencies.some((dep) => dep.id === entity.id);

          // Dependency cycle between different modules not allowed
          if (isCyclicDependency && candidate.path !== entity.path) throw new Error(`Cyclic dependency between modules not allowed: ${candidate.id} and ${entity.id}`);

          if (isCyclicDependency && candidate.index > entity.index) continue;

          dependencySet.add(candidate.key);
        }
      }
    }

    return dependencyGraph;
  }


  // Sorts the array of entities in the correct order, ensuring
  // dependencies come before dependents
  sortEntitiesByDependencyOrder() {
    const dependencyGraph = this.createDependencyGraph();
    const entityOrder = topologicalSort(dependencyGraph);

    // Maps from id of entity to its position in the script
    const keyToPositionMap: Record<string, number> = {};

    for (let i = 0; i < entityOrder.length; i++) {
      keyToPositionMap[entityOrder[i]] = i;
    }

    this.allEntities.sort((a, b) => keyToPositionMap[a.key] - keyToPositionMap[b.key]);
  }

  createNameCollisionMap(entities: ModuleEntity[]) {
    const nameEntityIdsMap: Record<string, Set<string>> = {};

    for (const entity of entities) {
      (nameEntityIdsMap[entity.name] ??= new Set()).add(entity.id);
    }

    const idToNewNameMap: Record<string, string> = {};

    for (const [name, idSet] of Object.entries(nameEntityIdsMap)) {
      if (idSet.size < 2) continue; // Unique name

      const separator = name.endsWith("_") ? "" : "_";

      const ids = Array.from(idSet);

      for (let i = 0; i < ids.length; i++) {
        idToNewNameMap[ids[i]] = `${name}${separator}${i}`;
      }

    }

    return idToNewNameMap;
  }


}

