import { GLSLPlugin } from "../core-system/glsl-plugin.js";
import { Func } from "../core-system/module-content/func.js";
import { matchIterator } from "../utils/match-iterator.js";

// Work in progress!

const pluginId = "destructuring";

const destructureRegex = /\w+\s*{\s*([^}]+)\s*}\s*=\s*/;

const testCode = /*glsl*/`

float someFunction() {

  vec3 inPosition = vec3(3, 2, 1);

  RayMarchResult { position, normal } = someFunction(inPosition);

  if (normal.x < 0.5) {
    vec3 position = vec3(1, 2, 3);

    RayMarchResult { position, normal: normal2 } = someFunction(position);

    while (true) {
      break;
    }

  }

  for (int i = 0; i < 10; i++) {
    do {
      i++
    } while (i < 10);
  }

}

`

function destructuringPlugin(): GLSLPlugin {
  
  return {
    id: pluginId,

    transform(moduleEntities) {
      determineBlockStructure(testCode);
      for (const entity of moduleEntities) {
        if (!(entity instanceof Func)) continue;

        entity.definition
      }

      return moduleEntities;
    },
  }
  
}

type BlockStructure = {
  code: string,
  childBlocks: BlockStructure[]
}

type Block = {
  start: number;
  end: number;
  children: Block[];
  declaredVariables: string[];
  code: string;
}

function determineBlockStructure(code: string) {
  const destructures = Array.from(matchIterator(code, destructureRegex));
  const forLoops = Array.from(matchIterator(code, /\bfor\s*\(/));

  let destructureIndex = 0;
  let forIndex = 0;
  let braceLevel = 0;

  const rootStart = code.indexOf("{");
  let rootBlock: Block = newBlock(rootStart);

  let blockStack: Block[] = [];
  let parentBlock: Block | null = null;
  let currentBlock: Block | null = rootBlock;
  for (let i = rootStart + 1, n = code.length; i < n; i++) {
    if (destructures[destructureIndex]?.startIndex === i) i = destructures[destructureIndex++].endIndex;
    
    const char = code[i];
    let hasNewBlock = char === "{";
    let newBlockIndex = i;

    if (forLoops[forIndex]?.startIndex === i) {
      hasNewBlock = true;
      
      i = code.indexOf("{", i) + 1;
      forIndex++;
    }


    if (hasNewBlock) {
      braceLevel++;
      
      if (parentBlock) blockStack.push(parentBlock);

      parentBlock = currentBlock;
      currentBlock = newBlock(newBlockIndex);
    } else if (char === "}") {
      if (!currentBlock) throw new Error(`Unbalanced braces in ${code}`);
      
      currentBlock.end = i + 1;
      processClosedBlock(code, currentBlock);
      console.log(currentBlock.code);

      if (parentBlock) parentBlock.children.push(currentBlock);

      currentBlock = parentBlock;
      parentBlock = blockStack.pop() ?? null;
      braceLevel--;
    }
  }

  return rootBlock;
}

function newBlock(start: number) {
  return { start, end: -1, children: [], declaredVariables: [], code: "" };
}

function processClosedBlock(code: string, block: Block) {
  const { start, end, children } = block;
  
  block.code = code.slice(start, end);
  // Remove nested blocks
  for (let i = 0; i < children.length; i++) {
    const child = children[i];

    block.code = block.code.replace(code.slice(child.start, child.end), `%${i}%`);
  }

  // Find declared variables

for (const match of matchIterator(block.code, /\b(\w)\s*=\s*/)) {
  block.declaredVariables.push(match.groups[0]);
}

console.log(block.code);
console.log(block.declaredVariables);
}

function processBlock(root: Block) {
  const { children } = root;

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    root.code = root.code.replace(`%${i}%`, child.code);
  }
}

/**
 * Plugin that destructures struct fields into variables
 * Strategy: Start by finding all blocks in the code.
 * Then, for each block, recursively find all nested blocks within it.
 * Each block consists of remainingCode (code where blocks are replaced with %block1% etc)
 * and an array of child blocks. We need to know all variable definitions in each block.
 * For each block: 
 *   Find all instances of destructuring (Struct { var1, var2 } = fn()) and create a new variable.
 *   Replace all instances of old names (var1 => obj.var1, var2 => obj.var2 etc)
 *   Iterate through all children and replace each variable unless it has been re-declared.
 * Finally, reconstruct all blocks 
 * Ensure to only rename instances that come after in code, even in same block?
 * For loops are a special case, where scoped variables are defined outside the block
 */

