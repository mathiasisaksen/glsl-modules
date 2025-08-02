
export class Match {
  selection: string;
  groups: string[];
  startIndex: number;
  endIndex: number;

  raw: RegExpMatchArray;

  constructor(match: RegExpMatchArray) {
    this.selection = match[0];
    this.groups = match.slice(1);
    this.startIndex = match.index!;
    this.endIndex = this.startIndex + match[0].length;
    this.raw = match;
  }

  static new(string: string, regex: RegExp) {
    const raw = string.match(regex);

    return raw && new Match(raw);
  }

}

export function* matchIterator(string: string, regexp: RegExp) {
  if (regexp instanceof RegExp && regexp.global) throw new Error("Must be non-global regexp");
  
  let indexOffset = 0;

  while (true) {
    const match = Match.new(string, regexp);

    if (!match) return;

    const removedLength = match.endIndex;
    string = string.slice(removedLength);
    
    match.startIndex += indexOffset;
    match.endIndex += indexOffset;
    
    indexOffset += removedLength;
    
    yield match;
  }
}