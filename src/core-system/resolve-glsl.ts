import { GLSLRegistry, GLSLRegistryOptions } from "./glsl-registry.js";

type ResolveOptions = GLSLRegistryOptions;

export function resolveGLSL(code: string, options: ResolveOptions) {
  return new GLSLRegistry(options).resolve(code);
}

