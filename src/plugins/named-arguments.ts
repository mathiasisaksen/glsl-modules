import { GLSLPlugin } from "../core-system/glsl-plugin.js";
import { Func, Struct } from "../core-system/module-content/index.js";
import { matchIterator, splitAtCommasOutsideBraces } from "../utils/index.js";

const pluginId = "named-arguments";

// Finds instances of functionName({ parameterString })
const namedParameterRegex = /(\w+)\s*\(\s*{\s*([^}]+)\s*}\s*\)/;
// Extracts name and value from a string on the form "name: value" or "value"
const extractParameterRegex = /^(?:(\w+\s*):)?\s*([\s\S]+)$/m;


export function namedArgumentsPlugin(): GLSLPlugin {
  return {
    id: pluginId,
    preprocess(code) {

      for (const match of matchIterator(code, namedParameterRegex)) {
        const parameterList = match.groups[1].trim();
        if (!parameterList) continue; // No parameters, continue

        const parameterMap = createParameterValueMap(parameterList, "wrap");

        const newParameterList = Object.entries(parameterMap)
          .map(([name, value]) => `${name}: ${value}`)
          .join(", ") +
          ","; // Ensures the list ends with a comma

        code = code.replace(parameterList, newParameterList);
      }

      return code;
    },
    transform(moduleEntities, context) {

      for (const entity of moduleEntities) {

        const replacements: { old: string, new: string }[] = [];

        for (const match of matchIterator(entity.definition, namedParameterRegex)) {

          const call = match.selection;
          const [entityName, parameterList] = match.groups;

          const candidates = context
            .getEntitiesByName(entityName)
            .map((v) => v.entity)
            .filter((e) => e.type === "function" || e.type === "struct") as (Func | Struct)[];

          if (!candidates) throw new Error(`No function/struct "${entityName}" found`);

          const parameterValueMap = createParameterValueMap(parameterList, "unwrap");

          // Used to find the correct function overload
          const parameterNameString = Object.keys(parameterValueMap).sort().join(",");

          // Find function that satisfies parameter names
          const entity = candidates.find((fn) => {
            const currentParameterNameString = fn.arguments.map(({ name }) => name).sort().join(",");
            return currentParameterNameString === parameterNameString;
          }) as Func | undefined;

          if (!entity) throw new Error(`No overload of ${entityName} with parameter names ${parameterNameString}`)

          const valueString = entity.arguments.map((arg) => parameterValueMap[arg.name]).join(", ");

          const newCall = call.replace(/{[^}]+}/, valueString);

          replacements.push({ old: call, new: newCall });
        }

        entity.definition = replacements.reduce((definition, r) => definition.replace(r.old, r.new), entity.definition);

      }


    }

  }
}

function createParameterValueMap(parameterList: string, mode: "wrap" | "unwrap") {
  const parameterStrings = splitAtCommasOutsideBraces(parameterList.trim())
    .filter((s) => s);

  const parameterNameValueMap = parameterStrings.reduce<Record<string, string>>((map, paramString) => {
    const extractionMatch = paramString.match(extractParameterRegex);

    if (!extractionMatch) throw new Error(`Unable to parse ${parameterList}`)

    let [, name, value] = extractionMatch;

    name ??= value;

    if (mode === "wrap") {
      name = `_${name}_`;
    } else {
      name = name.slice(1, -1);
    }

    map[name] = value;
    return map;
  }, {});

  return parameterNameValueMap;
}