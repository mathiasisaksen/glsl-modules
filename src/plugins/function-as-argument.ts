import { GLSLPlugin, PluginContext } from "../core-system/glsl-plugin.js";
import { EntityDependency } from "../core-system/module-content/entity-dependency.js";
import { Argument, Func } from "../core-system/module-content/func.js";
import { ModuleEntity } from "../core-system//module-content/types.js";
import { findClosingIndex } from "../utils/find-closing-index.js";
import { Match, matchIterator } from "../utils/match-iterator.js";
import { splitAtCommasOutsideBraces } from "../utils/split-at-commas-outside-braces.js";

const pluginId = "function-as-argument";
const higherOrderFunctionRegex = /\w+\s+(\w+)\s*\((.*)\)/;
const extractFunctionalArgumentExtractRegex = /\w+\s*\((.*)\)/;
const extractTypeAndBodyRegex = /(\w+)[^{]+([\s\S]+)/;
const functionalTypePlaceholder = "__fn_argument__";

type NewFunction = {
  key: string;
  func: Func;
}

/**
 * Strategy: This plugin implements higher order functions (HOF),
 * i.e. passing a function as a parameter to another function.
 * A HOF is indicated
 * The preprocessing replaces 
 * 
 */

export function functionAsArgumentPlugin(): GLSLPlugin {
  return {
    id: pluginId,
    preprocess(code) {
      // 1. Find higher-order functions 
      const signatureRegex = /((\w+)\s+(\w+)\s*\(([\w\s,\(\)]*)\))\s*{/g;
      while (true) {
        const match = signatureRegex.exec(code);
        
        if (!match) break;
        
        const [, signature, returnType, name, argumentsString] = match;
        
        const argumentStrings = splitAtCommasOutsideBraces(argumentsString);

        if (!argumentStrings.some((argument) => argument.match(higherOrderFunctionRegex))) continue;

        // Replace functional argument with argument of type functionalTypePlaceholder
        const newArgString = transformFunctionalArguments(argumentStrings);
        
        code = code.replace(signature, `${returnType} ${name}(${newArgString})`);
        
        signatureRegex.lastIndex = match.index! + match[0].length;
      }

      return code;
    },
    transform(moduleEntities, context, isShader) {
      // Does the module contain any functions (local or imported) that are higher-order functions?
      // If so, find all usages of each one and create new functions
      
      let newFunctions = determineNewFunctions(moduleEntities, context);
      
      // Do not include HOFs in output
      if (isShader) moduleEntities = moduleEntities.filter((entity) => !isHigherOrderFunction(entity));

      return moduleEntities.concat(newFunctions);
    },
  }
}

function getFunctionalArguments(func: Func) {
  return func.arguments.filter((arg) => arg.type === functionalTypePlaceholder)
}

function isHigherOrderFunction(entity: ModuleEntity) {
  return entity instanceof Func && 
    entity.arguments.some((arg) => arg.type === functionalTypePlaceholder);
}

function findHigherOrderFunctions(candidates: ModuleEntity[]) {
  return candidates.filter((entity) => isHigherOrderFunction(entity)) as Func[];
}

function transformFunctionalArguments(argumentStrings: string[]) {
  return argumentStrings
    .map((argString) => {
      const functionArgumentMatch = argString.match(higherOrderFunctionRegex);
      return functionArgumentMatch ? `${functionalTypePlaceholder} ${functionArgumentMatch[1]}` : argString;
    }).join(", ");
}

function determineNewFunctions(moduleEntities: ModuleEntity[], context: PluginContext) {
  const newFunctions: NewFunction[] = [];

  const functionUsageCount: Record<string, number> = {};
  const memoizedHOFs: Record<string, Func[]> = {};

  let entityIndex = Math.max(...moduleEntities.map((entity) => entity.index + entity.definition.length)) + 2;
  
  let candidateEntities = Array.from(moduleEntities);

  while (candidateEntities.length > 0) {
    const candidateEntity = candidateEntities.pop()!;
    
    if (!(candidateEntity instanceof Func)) continue;

    const candidateFunctionalArguments = getFunctionalArguments(candidateEntity);
    const candidateIsHOF = candidateFunctionalArguments.length > 0;

    if (candidateIsHOF) continue;

    const { definition } = candidateEntity;

    for (const { id, localName } of Array.from(candidateEntity.dependencies)) {
      const higherOrderFunctions = memoizedHOFs[id] ??= findHigherOrderFunctions(context.getEntitiesById(id));

      for (const func of higherOrderFunctions) {
        const allArguments = func.arguments;
        const functionalArguments = getFunctionalArguments(func);
        const functionCallRegex = new RegExp(`\\b${localName}\\b\\s*\\(`);
        
        for (const match of matchIterator(definition, functionCallRegex)) {
          const { startIndex } = match;
    
          const functionCall = definition.slice(startIndex, findClosingIndex(definition, startIndex, "(", ")"));
    
          const extractMatch = Match.new(functionCall, extractFunctionalArgumentExtractRegex);
  
          if (!extractMatch) throw new Error(`Unable to extract arguments from ${functionCall}`);
    
          const currentArguments = splitAtCommasOutsideBraces(extractMatch.groups[0]);
    
          // Different number of arguments -> different overload of higherOrderFunction is called
          if (allArguments.length !== currentArguments.length) continue;
    
          let functionalArgNameValueMap = createFunctionalArgumentValueMap(functionalArguments, currentArguments);
          
    
          const key = createFunctionKey(func, functionalArgNameValueMap);
    
          let newFunction = newFunctions.find((fn) => fn.key === key);
    
          if (!newFunction) {
            const usageIndex = functionUsageCount[localName] ??= 0;
            const newName = `_${localName}_${usageIndex}_`;
            const newFunc = createHOFInstance(func, newName, entityIndex, functionalArgNameValueMap, context)
            
            newFunction = { key, func: newFunc };
            newFunctions.push(newFunction);
            candidateEntities.push(newFunc);

            entityIndex += newFunc.definition.length;

            functionUsageCount[localName]++;
          }
    
          const newName = newFunction.func.name;

          const nonFunctionalArguments = currentArguments.filter((_, i) => allArguments[i].type !== functionalTypePlaceholder);
          candidateEntity.definition = candidateEntity.definition.replace(functionCall, `${newName}(${nonFunctionalArguments.join(", ")})`);

          candidateEntity.removeDependency(func.id);
          candidateEntity.addDependencies(new EntityDependency(newName, context.path, "ambient"));
    
        }
      }
    }
  }

  return newFunctions.map(({ func }) => func);
}

// A unique key for a combination of HOF call and arguments
function createFunctionKey(func: Func, functionalArgNameValueMap: Record<string, string>) {
  const signature = Object.keys(functionalArgNameValueMap)
    .sort()
    .map((name) => functionalArgNameValueMap[name])
    .join(",");
  return `${func.id}:${signature}`;
}

function createFunctionalArgumentValueMap(functionalArguments: Argument[], callValues: string[]) {
  let functionalArgNameValueMap: Record<string, string> = {};
  for (const { name, index } of functionalArguments) {
    functionalArgNameValueMap[name] = callValues[index];
  }

  return functionalArgNameValueMap;
}

function createHOFInstance(func: Func, newName: string, index: number, functionalArgNameValueMap: Record<string, string>, context: PluginContext) {
  const [type, body] = Match.new(func.definition, extractTypeAndBodyRegex)!.groups;
  
  // TODO ensure that functional argument does not clash with parameter name (e.g. parameter and function both named p)
  const newArguments = func.arguments
    .filter((arg) => arg.type !== functionalTypePlaceholder);

  const argString = newArguments
    .map((arg) => `${arg.type} ${arg.name}`)
    .join(", ");

  let definition = `${type} ${newName}(${argString}) ${body}`;

  // New dependencies that come from function parameters
  let functionArgumentDependencies: EntityDependency[] = [];
  
  for (const [name, value] of Object.entries(functionalArgNameValueMap)) {
    definition = definition.replace(new RegExp(`\\b${name}\\b`, "g"), value);

    for (const dependency of context.getEntitiesByName(value)) {
      const { localName, entity: dependentEntity, isImport } = dependency;

      if (functionArgumentDependencies.find((d) => d.id === dependentEntity.id)) continue;

      const alias = localName === dependentEntity.name ? undefined : localName;
      functionArgumentDependencies.push(new EntityDependency(dependentEntity.name, dependentEntity.path, isImport ? "import" : "ambient", alias));
    }

  }

  const newFunction = new Func(newName, context.path, index, definition, newArguments);

  newFunction.addDependencies(...func.dependencies, ...functionArgumentDependencies);
  
  return newFunction;
}
