import { GLSLModule, ModuleContext } from "./glsl-module.js";
import { GLSLPlugin } from "./glsl-plugin.js";

type NestedLibraryDefinition = {
  [key: string]: NestedLibraryDefinition | string;
}

type LibraryModules = Record<string, GLSLModule>;
type LibraryDefinition = NestedLibraryDefinition | string;

const extractLibraryNameRegex = /([^/]+)(?:\/.+)?/;
const indexKey = "@index";

export type GLSLLibraryOptions = {
  name: string,
  definition: LibraryDefinition,
  plugins?: Array<GLSLPlugin>,
  dependencies?: Array<GLSLLibrary>;
}

export class GLSLLibrary {
  name: string;
  modules: LibraryModules = {};
  plugins: Array<GLSLPlugin>;

  dependencies: Record<string, GLSLLibrary>;

  private isCompiled = false;
  private definition: NestedLibraryDefinition;

  constructor(options: GLSLLibraryOptions) {
    const { name, definition, plugins = [], dependencies = [] } = options;

    this.name = name;
    this.plugins = plugins;

    if (typeof definition === "string") {
      this.definition = { [indexKey]: definition };
    } else {
      this.definition = definition;
    }

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

    processLibraryStructure(name, definition, this.modules, context);

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
function processLibraryStructure(parentName: string, structure: NestedLibraryDefinition, moduleObject: LibraryModules, context: ModuleContext) {
  for (const [key, entry] of Object.entries(structure)) {
    const currentPath = key === indexKey ? parentName : `${parentName}/${key}`;

    if (typeof entry === "string") {
      moduleObject[currentPath] = new GLSLModule(currentPath, entry, context);
    } else {
      processLibraryStructure(currentPath, entry, moduleObject, context);
    }

  }
}
