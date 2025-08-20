import { GLSLLibrary } from "./glsl-library.js";
import { GLSLModule } from "./glsl-module.js";
import { GLSLPlugin } from "./glsl-plugin.js";

export type GLSLRegistryOptions = {
  libraries?: GLSLLibrary[];
  plugins?: GLSLPlugin[];
}

export class GLSLRegistry {
  libraries: Record<string, GLSLLibrary> = {};
  plugins: GLSLPlugin[] = [];

  constructor(options?: GLSLRegistryOptions) {
    const { libraries = [], plugins = [] } = options ?? {};

    for (const library of libraries) this.addLibrary(library);
    for (const plugin of plugins) this.addPlugin(plugin);
  }

  addLibrary(library: GLSLLibrary) {
    this.libraries[library.name] = library;
    return this;
  }

  addPlugin(plugin: GLSLPlugin) {
    this.plugins.push(plugin);
  }

  resolve(code: string) {
    const { libraries, plugins } = this;

    const module = new GLSLModule("@shader", code, { libraries, plugins });

    module.isShaderModule = true;

    module.applyPlugins();

    return module.resolve();
  }

}
