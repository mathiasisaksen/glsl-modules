import { EntityDependency } from "./entity-dependency.js";

export abstract class ModuleEntity {
  key: string;
  id: string;
  name: string;
  path: string;
  definition: string;
  
  index: number;
  
  dependencies: EntityDependency[] = [];

  pluginData: any[] = [];
  
  constructor(name: string, path: string, index: number, definition: string) {
    this.id = `${path}/${name}`;
    this.key = this.id;
    this.name = name;
    this.path = path;
    this.index = index;
    this.definition = definition.trim();
  }

  getKey() { return this.id; }

  getResolvedDefinition(idNameMap: Record<string, string>) {
    let { definition, name, id, dependencies } = this;

    const newName = idNameMap[id];
    if (newName) definition = definition.replace(new RegExp(`\\b${name}\\b`), newName);

    for (const dependency of dependencies) {
      const newDependencyName = idNameMap[dependency.id];

      if (newDependencyName) {
        definition = definition.replaceAll(new RegExp(`\\b${dependency.localName}\\b`, "g"), newDependencyName);
      } else if (dependency.alias) {
        definition = definition.replaceAll(new RegExp(`\\b${dependency.alias}\\b`, "g"), dependency.name);
      }

    }

    return `/* ${id} */\n` + definition;
  }

  isDependentOn(candidate: ModuleEntity) {
    return this.dependencies.some((dependency) => dependency.id === candidate.id);
  }

  addDependencies(...dependencies: EntityDependency[]) {
    for (const dependency of dependencies) {
      if (this.dependencies.find((d) => d.id === dependency.id)) return;
      this.dependencies.push(dependency);
    }
  }

  removeDependency(id: string) {
    const index = this.dependencies.findIndex((d) => d.id === id);

    if (index === -1) return;

    this.dependencies.splice(index, 1);
  }

  protected abstract getDependencyTestString(): string;
  determineDependencies(candidateDependencies: EntityDependency[]) {
    const dependencyTestString = this.getDependencyTestString();
    
    const dependencies = candidateDependencies
      .filter((dependency) => dependency.isDependencyOf(dependencyTestString));

    this.addDependencies(...dependencies);
  }

}

