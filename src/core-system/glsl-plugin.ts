import { Import, ModuleEntity } from "./module-content/index.js";

export type EntityWithContext<E extends ModuleEntity = ModuleEntity> = {
  entity: E;
  localName: string;
  isImport: boolean;
}

export class PluginContext {
  path: string;
  localEntities!: EntityWithContext[]; // Entities that are defined in module
  importedEntities!: EntityWithContext[]; // Entities that are explicitly imported
  allEntities!: ModuleEntity[]; // All entities, including all dependencies of imports

  imports!: Import[];

  constructor(path: string, localEntities: ModuleEntity[], imports: Import[], importedEntities: ModuleEntity[]) {
    this.path = path;
    this.updateEntities(localEntities, imports, importedEntities);
  }

  updateEntities(localEntities: ModuleEntity[], imports: Import[], importedEntities: ModuleEntity[]) {
    this.localEntities = localEntities
      .map((entity) => ({ entity, localName: entity.name, isImport: false }));
    this.imports = imports;

    this.importedEntities = [];

    // Determine which are explicitly imported
    for (const i of imports) {
      const imports = importedEntities
        .filter((e) => e.id === i.id)
        .map((entity) => ({ entity, localName: i.alias ?? i.name, isImport: true }));
      this.importedEntities.push(...imports);
    }

    this.allEntities = localEntities.concat(importedEntities);
  }

  getEntitiesByName(name: string): EntityWithContext[] {
    let entities = this.localEntities.filter((e) => e.localName === name);
  
    if (entities.length > 0) return entities;

    return this.importedEntities.filter((e) => e.localName === name);
  }

  getEntitiesById(id: string) {
    return this.allEntities.filter((entity) => entity.id === id);
  }
}

export type GLSLPlugin = {
  id: string,
  preprocess?: (code: string, isShader: boolean) => string;
  transform?: (moduleEntities: ModuleEntity[], context: PluginContext, isShader: boolean) => ModuleEntity[] | void;
  postprocess?: (code: string, entity: ModuleEntity, context: PluginContext, isShader: boolean) => string,
}

type GLSLPluginFunction<A extends any[] = any[]> = (...args: A) => GLSLPlugin;

export function definePlugin<A extends any[]>(pluginFunction: GLSLPluginFunction<A>) {
  return pluginFunction;
}
