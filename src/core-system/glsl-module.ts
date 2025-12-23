import { Export, Import, ModuleEntity } from "./module-content/index.js";
import { GLSLParser } from "./glsl-parser.js";
import { GLSLPlugin, PluginContext } from "./glsl-plugin.js";
import { GLSLLibrary } from "./glsl-library.js";
import { resolveDependencies } from "../utils/resolve-dependencies.js";
import { removeComments } from "../utils/remove-comments.js";
import { Resolver } from "./resolver.js";

type EntityRequest = {
  name: string;
  type: "import" | "ambient";
  originId: string;
}

export type ModuleContext = {
  libraries: Record<string, GLSLLibrary>,
  plugins: Array<GLSLPlugin>,
}

export class GLSLModule {
  path: string;

  entities: Array<ModuleEntity> = [];
  imports: Array<Import> = [];
  exports: Array<Export> = [];
  unparsedCode: string;

  isShaderModule = false;

  moduleContext: ModuleContext;
  pluginContext!: PluginContext;

  constructor(path: string, code: string, context: ModuleContext) {
    this.path = path;
    this.moduleContext = context;
    const parser = this.parse(code);
    this.unparsedCode = parser.code;
  }

  parse(code: string) {
    code = removeComments(code);

    for (const plugin of this.moduleContext.plugins) {
      if (!plugin.preprocess) continue;

      code = plugin.preprocess(code, this.isShaderModule);
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
    const { path, isShaderModule: isOutputModule, } = this;
    const { plugins, libraries } = this.moduleContext;

    let importedEntities = resolveDependencies(this.entities, libraries);

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

  getEntity(request: EntityRequest): Array<ModuleEntity> {
    const { name, type } = request;

    if (type === "import") this.validateExport(request);

    const entity = this.entities.filter((entity) => entity.name === name);

    if (entity.length === 0) throw new Error(`Could not find entity "${name}" in module ${this.path}`);

    return entity;
  }

  resolve() {
    return new Resolver(this).resolve();
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
