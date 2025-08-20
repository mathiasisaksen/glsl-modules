import { GLSLPlugin } from "../core-system/glsl-plugin.js";
import { functionSignatureRegex } from "../core-system/module-content/func.js";
import { findClosingIndex } from "../utils/find-closing-index.js";
import { Match } from "../utils/match-iterator.js";
import { replaceByIndex } from "../utils/replace-by-index.js";

const pluginId = "arrow-functions";
const anonymousName = "_anonymous_";

const namedArrowFunctionRegex = /(\w+)\s+(\w+)\s*=\s*\(([\w\s, ()]*)\)\s*=>\s*({)?/;
const anonymousArrowFunctionRegex = /(\w+)\s*\(([\w, ]*)\)\s*=>\s*({)?/;

type ArrowFunction = {
  type: string;
  name: string; 
  argsString: string; 
  body: string;
  startIndex: number;
  endIndex: number;
  isAnonymous: boolean;
}

type FunctionBlock = {
  name: string;
  definition: string;
}

type NameUsageMap = Record<string, number>;

export function arrowFunctionsPlugin(): GLSLPlugin {
  return {
    id: pluginId,

    preprocess(code) {
      let { remainingCode, functionBlocks } = extractFunctionBlocks(code);
      
      remainingCode = processGlobalArrowFunctions(remainingCode, functionBlocks);
      
      let nameUsageMap: NameUsageMap = {};
      // Ensure no collision with non-arrow/global arrow functions
      for (const { name } of functionBlocks) nameUsageMap[name] = -1;

      const processedFunctionStrings = processFunctionBlocks(functionBlocks, nameUsageMap);

      code = remainingCode + processedFunctionStrings.join("\n\n");

      return code;
    },
  }
}

function extractFunctionBlocks(code: string) {
  const functionBlocks: FunctionBlock[] = [];

  while (true) {
    const match = Match.new(code, functionSignatureRegex);

    if (!match) break;
   
    const name = match.groups[2];
    const start = match.startIndex;
    const end = findClosingIndex(code, start);

    let definition = code.slice(start, end);

    code = replaceByIndex(code, start, end, "");

    functionBlocks.push({ name, definition });
  }

  return { remainingCode: code, functionBlocks };
}

function findNextArrowFunction(code: string, mode: "named" | "anonymous"): ArrowFunction | undefined {
  const namedMode = mode === "named";
  const match = Match.new(code, namedMode ? namedArrowFunctionRegex : anonymousArrowFunctionRegex);

  if (!match) return;

  const { selection, startIndex } = match;

  let type: string, name: string, argsString, blockStart: string;

  if (namedMode) {
    [type, name, argsString, blockStart] = match.groups;
  } else {
    [type, argsString, blockStart] = match.groups;
    name = "";
  }

  let bodyStartIndex = match.startIndex + selection.length;
  let endIndex: number;
  let isBlockFunction = blockStart !== undefined;

  if (isBlockFunction) {
    bodyStartIndex = code.indexOf("{", startIndex);
    endIndex = findClosingIndex(code, bodyStartIndex);
  } else if (namedMode) {
    endIndex = code.indexOf(";", bodyStartIndex) + 1;
  } else {
    endIndex = findAnonymousFunctionEnd(code, bodyStartIndex);
  }

  const body = code.slice(bodyStartIndex, endIndex).trim();

  let newFunctionBody = isBlockFunction ? body : `{\n  return ${body}${body.endsWith(";") ? "" : ";"}\n}`;

  return { 
    type, name, argsString, body: newFunctionBody, 
    startIndex, endIndex, isAnonymous: !namedMode
  };
}


function processGlobalArrowFunctions(code: string, functionBlocks: FunctionBlock[]) {  
  while (true) {
    const arrowFunction = findNextArrowFunction(code, "named");

    if (!arrowFunction) break;

    const { type, name, argsString, body, startIndex, endIndex } = arrowFunction;
    const definition = `${type} ${name}(${argsString}) ${body}`;

    functionBlocks.push({ name, definition })

    code = replaceByIndex(code, startIndex, endIndex, "");

  }
  
  return code;
}


function processFunctionBlocks(functionBlocks: FunctionBlock[], nameUsageMap: NameUsageMap): string[] {
  const unprocessedFunctionBlocks = Array.from(functionBlocks);
  const processedFunctionStrings: string[] = [];

  while (unprocessedFunctionBlocks.length > 0) {
    let { definition } = unprocessedFunctionBlocks.shift()!;

    let newFunctions: ArrowFunction[] = [];
    let seenNames = new Set<string>();
  
    // Find named arrow functions
    while (true) {
      const arrowFunction = findNextArrowFunction(definition, "named");

      if (!arrowFunction) break;

      newFunctions.push(arrowFunction);
      seenNames.add(arrowFunction.name);
      definition = replaceByIndex(definition, arrowFunction.startIndex, arrowFunction.endIndex, "");
    } 

    // Find anonymous functions
    while (true) {
      const anonymousFunction = findNextArrowFunction(definition, "anonymous");

      if (!anonymousFunction) break;

      const index = nameUsageMap[anonymousName] ??= 0;
      anonymousFunction.name = `${anonymousName}${index}`;

      newFunctions.push(anonymousFunction);

      definition = replaceByIndex(definition, anonymousFunction.startIndex, anonymousFunction.endIndex, anonymousFunction.name);

      nameUsageMap[anonymousName]++;
    }

    for (let i = 0, n = newFunctions.length; i < n; i++) {
      const { name, type, argsString, body, isAnonymous } = newFunctions[i];
  
      let newFunctionName: string;

      if (isAnonymous) {
        newFunctionName = name;
      } else {
        const newFunctionIndex = nameUsageMap[name] ??= 0;
        newFunctionName = `${name}_${newFunctionIndex}`;
      }
      
      const newFunctionDefinition = `${type} ${newFunctionName}(${argsString}) ${body}`;
      unprocessedFunctionBlocks.push({ name: newFunctionName, definition: newFunctionDefinition });
      
      if (isAnonymous) continue; 

      const functionCallRegex = new RegExp(`\\b${name}\\b`, "g");
      // If named, ensure that any reference of old function name is replaced with new
      definition = definition.replace(functionCallRegex, newFunctionName);

      for (let j = i + 1; j < n; j++) { // Including any arrow function that comes after
        const fn = newFunctions[j];
        fn.body = fn.body.replace(functionCallRegex, newFunctionName);
      }      
    }

    for (const name of seenNames) nameUsageMap[name]++;
  
    processedFunctionStrings.push(definition);

  }

  return processedFunctionStrings;

}

const anonymousEndCharacters = new Set([")", ",", "}"]);
function findAnonymousFunctionEnd(input: string, start: number) {

  let nestedness = 0;

  for (let i = start; i < input.length; i++) {
    const char = input[i];

    if (nestedness === 0 && anonymousEndCharacters.has(char)) {
      return i;
    } else if (char === "(" || char === "{") {
      nestedness++;
    } else if (char === ")" || char === "}") {
      nestedness--;
    }
  }

  throw new Error("Unable to find end of anonymous function");
}