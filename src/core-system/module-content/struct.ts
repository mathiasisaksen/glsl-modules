import { Argument } from "./func.js";
import { BaseEntity } from "./base-entity.js";

export const structRegex = /^ *(struct\s+(\w+)\s*{([^}]+)}\s*;)/m;
const extractStructBodyRegex = /^[^{]*{([\s\S]*)}\s*;$/;

export class Struct extends BaseEntity {
  override readonly type = "struct";
  arguments: Array<Argument>;

  constructor(name: string, path: string, index: number, definition: string, args: Array<Argument>) {
    super(name, path, index, definition);
    this.arguments = args;
  }

  protected getDependencyTestString(): string {
    const { definition } = this;

    const structBodyMatch = definition.match(extractStructBodyRegex);

    if (!structBodyMatch) throw new Error(`Unable to extract from struct: ${definition}`);

    const structBody = structBodyMatch[1];
    return structBody;
  }

}
