import { Export, Import, ModuleEntity } from "./module-content/index.js";
import { GLSLParser } from "./glsl-parser.js";
import { GLSLPlugin, PluginContext } from "./glsl-plugin.js";
import { GLSLLibrary } from "./glsl-library.js";
import { resolveDependencies } from "../utils/resolve-dependencies.js";
import { DependencyGraph, assert, topologicalSort } from "../utils/index.js";
import { removeComments } from "../utils/remove-comments.js";

type EntityRequest = {
  name: string;
  type: "import" | "ambient";
  originId: string;
}

export type ModuleContext = {
  libraries: Record<string, GLSLLibrary>,
  plugins: GLSLPlugin[],
}

export class GLSLModule {
  path: string;

  entities: ModuleEntity[] = [];
  imports: Import[] = [];
  exports: Export[] = [];
  unparsedCode: string;

  isOutputModule: boolean;

  moduleContext: ModuleContext;
  pluginContext!: PluginContext;

  constructor(path: string, code: string, context: ModuleContext, isOutputModule = false) {
    this.path = path;
    this.moduleContext = context;
    this.isOutputModule = isOutputModule;
    const parser = this.parse(code);
    this.unparsedCode = parser.code;
  }

  parse(code: string) {
    code = removeComments(code);
    
    for (const plugin of this.moduleContext.plugins) {
      if (!plugin.preprocess) continue;
      
      code = plugin.preprocess(code, this.isOutputModule);
    }

    const parser = new GLSLParser(code, this.path).parseAll();

    parser.determineDependencies();
   
    const { entities, imports, exports } = parser;

    this.imports = imports;
    this.exports = exports;
    this.entities = entities;

    return parser;
  }

  applyPlugins() {
    const { path, isOutputModule, } = this;
    const { plugins, libraries: dependencies } = this.moduleContext;

    let importedEntities = resolveDependencies(this.entities, dependencies);
    // TODO Again, temporary solution
    importedEntities = [...new Set(importedEntities)];

    const context = this.pluginContext = new PluginContext(path, this.entities, this.imports, importedEntities);

    for (const plugin of plugins) {
      if (!plugin.transform) continue;

      const result = plugin.transform?.(this.entities, context, isOutputModule);

      if (result) context.updateEntities(result, this.imports, importedEntities);
    }

    for (const plugin of plugins) {
      if (!plugin.postprocess) continue;

      for (const entity of this.entities) {
        entity.definition = plugin.postprocess(entity.definition, entity, context, isOutputModule);
      }
    }

    this.entities = context.localEntities.map(({ entity }) => entity);
  }

  getEntity(request: EntityRequest): ModuleEntity[] {
    const { name, type } = request;

    if (type === "import") this.validateExport(request);
    
    const entity = this.entities.filter((entity) => entity.name === name);
    
    if (entity.length === 0) throw new Error(`Could not find entity "${name}" in module ${this.path}`);
    
    return entity;
  }

  resolve() {        
    let entities = this.entities
      .concat(resolveDependencies(this.entities, this.moduleContext.libraries))

    // TODO this is a temporary solution, resolveDependencies should not have duplicate entities to begin with
    entities = [...new Set(entities)];
    
    const idToNewNameMap = createNameCollisionMap(entities);
      
    sortEntitiesByDependencyOrder(entities);

    let resolvedCode = 
        [this.unparsedCode.trim()]
        .concat(entities.map((entity) => entity.getResolvedDefinition(idToNewNameMap)))
        .join("\n\n");
        
    // Make code slightly more readable by removing excessive spacing
    resolvedCode = resolvedCode.replace(/\n+\s*\n+/g, "\n\n");
    
    return resolvedCode;
  }

  private validateExport(request: EntityRequest) {
    const { name, originId } = request;

    const entityExport = this.exports.find((e) => e.name === name);

    if (!entityExport) throw new Error(`No export "${name}" in module ${this.path}`);

    switch (entityExport.qualifier) {
      case "internal": {
        const originLibrary = GLSLLibrary.extractLibraryNameFromPath(originId);
        const currentLibrary = GLSLLibrary.extractLibraryNameFromPath(this.path);
        if (originLibrary !== currentLibrary) throw new Error(`Cannot import internal export "${name}" from outside "${this.path}"`);
      }
    }
    
  }
}


// Creates graph that describes dependency structure of entities. 
// The graph is represented as an object mapping each id to a set containing its
// dependencies
function createDependencyGraph(entities: ModuleEntity[]) {
  const dependencyGraph: DependencyGraph = {};

  const idToEntityMap = entities.reduce<Record<string, ModuleEntity[]>>((map, entity) => { 
    (map[entity.id] ??= []).push(entity); 
    return map;
   }, {});

  for (const entity of entities) {
    const dependencySet = dependencyGraph[entity.key] ??= new Set();
    for (const dependency of entity.dependencies) {     
      // Get all entities that are potential dependencies 
      const candidateEntities = idToEntityMap[dependency.id];

      for (const candidate of candidateEntities) {
        if (candidate.key === entity.key) continue;
        // If the candidate has entity as dependency, there is a 
        // dependency cycle -> only include candidates that come
        // before it in module

        const isCyclicDependency = candidate.dependencies.some((dep) => dep.id === entity.id);

        // Dependency cycle between different modules not allowed
        assert(!(isCyclicDependency && candidate.path !== entity.path), `Cyclic dependency between modules not allowed: ${candidate.id} and ${entity.id}`);

        if (isCyclicDependency && candidate.index > entity.index) continue;

        dependencySet.add(candidate.key);
      }
    }
  }

  return dependencyGraph;
}

// Takes an array of entities and sorts it in the correct order, ensuring
// dependencies come before dependents
function sortEntitiesByDependencyOrder(entities: ModuleEntity[]) {
  const dependencyGraph = createDependencyGraph(entities);
  const entityOrder = topologicalSort(dependencyGraph);
  
  // Maps from id of entity to its position in the script
  const keyToPositionMap: Record<string, number> = {};

  for (let i = 0; i < entityOrder.length; i++) {
    keyToPositionMap[entityOrder[i]] = i;
  }
  
  entities.sort((a, b) => keyToPositionMap[a.key] - keyToPositionMap[b.key]);
}

// Creates a map from the ids of entities with name collisions to new names
function createNameCollisionMap(entities: ModuleEntity[]) {
  const nameEntityIdsMap: Record<string, Set<string>> = {};

  for (const entity of entities) {
    const set = nameEntityIdsMap[entity.name] ??= new Set();
    set.add(entity.id);
  }

  const idToNewNameMap: Record<string, string> = {};

  for (const [name, idSet] of Object.entries(nameEntityIdsMap)) {
    if (idSet.size < 2) continue; // Unique name

    const separator = name.endsWith("_") ? "" : "_";

    const ids = [...idSet];

    for (let i = 0; i < ids.length; i++) {
      idToNewNameMap[ids[i]] = `${name}${separator}${i}`;
    }
    
  }
  
  return idToNewNameMap;
}

