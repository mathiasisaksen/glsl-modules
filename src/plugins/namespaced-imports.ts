import { GLSLPlugin } from "../core-system/glsl-plugin.js";

const pluginId = "namespaced-imports";
const globalImportRegex = /import\s+(["'`]?)([^\s"'`]+)\1\s+as\s+(\w+);?/;
const findUsageRegex = (namespace: string) => new RegExp(`\\b(${namespace}(?:\\.\\w+)+)\\b`, "g");

export function namespacedImportsPlugin(): GLSLPlugin {
  return {
    id: pluginId,
    preprocess(input) {
      let result = input;

      while (true) {
        const globalImportMatch = result.match(globalImportRegex);        

        if (!globalImportMatch) break;
        
        const [globalImportString, , path, namespace] = globalImportMatch;
        
        const usageRegex = findUsageRegex(namespace);
        
        // A usage is a place where the global import is used
        const usages =  new Set(result.match(usageRegex) ?? []);
        const newImportsMap: Record<string, string[]> = {};

        for (const usage of usages) {
          const pathComponents = usage.split(".");
          const alias = pathComponents.join("_");

          const name = pathComponents.pop()!;
          const importPath = [path, ...pathComponents.slice(1)].join("/");

          (newImportsMap[importPath] ??= []).push(`${name} as ${alias}`);

          result = result.replaceAll(usage, alias);
        }
        const newImportBlocks = Object.keys(newImportsMap).map((path) => {
          const imports = newImportsMap[path];
          return `import {\n  ${imports.join(",\n  ")}\n} from "${path}"`
        });

        result = result.replace(globalImportString, newImportBlocks.join("\n"));
      }
      
      return result;
    },
  }
}