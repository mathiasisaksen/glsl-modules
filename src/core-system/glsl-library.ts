import { GLSLModule, ModuleContext } from "./glsl-module.js";
import { GLSLPlugin } from "./glsl-plugin.js";
import { ModuleEntity } from "./module-content/types.js";

type LibraryStructure = {
  [key: string]: LibraryStructure | GLSLModule | string;
}

type LibraryModules = Record<string, GLSLModule>;
type DefinitionInput = LibraryStructure | GLSLModule | string;

const extractLibraryNameRegex = /([^/]+)(?:\/.+)?/;
const indexKey = "@index";

export type GLSLLibraryOptions = {
  name: string,
  definition: DefinitionInput,
  plugins?: GLSLPlugin[],
  dependencies?: GLSLLibrary[];
}

export class GLSLLibrary {
  name: string;
  modules: LibraryModules = {};
  plugins: GLSLPlugin[];

  dependencies: Record<string, GLSLLibrary>;

  private isCompiled = false;
  private definition: LibraryStructure | GLSLModule | string;
  
  constructor(options: GLSLLibraryOptions) {
    const { name, definition, plugins = [], dependencies = [] } = options;
    
    this.name = name;
    this.plugins = plugins;
    this.definition = definition;

    this.dependencies = { [name]: this };
    for (const dependency of dependencies) this.addDependency(dependency);
  }

  // A path always starts with the name of the library (i.e. libraryName/module/etc...)
  static extractLibraryNameFromPath(path: string) {
    const match = path.match(extractLibraryNameRegex);

    if (!match) throw new Error(`Unable to extract library name from ${path}`);

    return match[1];
  }

  compile() {
    if (this.isCompiled) return;
    
    this.isCompiled = true;

    const { definition, plugins, name } = this;

    const context: ModuleContext = { plugins, libraries: this.dependencies };

    if (definition instanceof GLSLModule) {
      this.modules[indexKey] = definition;
    } else if (typeof definition === "string") { 
      this.modules[indexKey] = new GLSLModule(name, definition, context);
    } else {
      processLibraryStructure(name, definition, this.modules, context);
    }

    for (const module of Object.values(this.modules)) module.applyPlugins();

  }

  addPlugin(plugin: GLSLPlugin) {
    this.plugins.push(plugin);
  }

  getEntity(path: string, name: string, type: "import" | "ambient", originId: string) {
    this.compile();

    const module = this.modules[path];

    if (!module) throw new Error(`No module "${path}" in library ${this.name}`);
    
    return module.getEntity({ name, type, originId });
  }

  addDependency(library: GLSLLibrary) {
    this.dependencies[library.name] = library;
    return this;
  }

}

// Creates a nested structure of modules
function processLibraryStructure(parentName: string, structure: LibraryStructure, moduleObject: LibraryModules, context: ModuleContext) {
  for (const [key, entry] of Object.entries(structure)) {
    const currentPath = key === indexKey ? parentName : `${parentName}/${key}`;

    if (typeof entry === "string") {
      moduleObject[currentPath] = new GLSLModule(currentPath, entry, context);
    } else if (entry instanceof GLSLModule) {
      moduleObject[currentPath] = entry;
    } else {
      processLibraryStructure(currentPath, entry, moduleObject, context);
    }

  }
}
