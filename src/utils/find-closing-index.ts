export function findClosingIndex(string: string, startIndex: number, openCharacter = "{", closeCharacter = "}") {  
  let index = string.indexOf(openCharacter, startIndex);

  if (index === -1) throw new Error(`No block opening found in ${string}`);

  let braceCount = 0;
  while (true) {
    const character = string[index++];

    if (character === openCharacter) {
      braceCount += 1;
    } else if (character === closeCharacter) {
      braceCount -= 1;
    }

    if (braceCount === 0 || index === string.length) break;

  }

  if (braceCount !== 0) throw new Error("Invalid code block, finished inside unclosed brackets");

  return index;

}