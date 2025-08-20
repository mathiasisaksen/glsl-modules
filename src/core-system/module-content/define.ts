import { BaseEntity } from "./base-entity.js";

export const defineRegex = /^ *(#define +(\w+(?:\([^\)]*\))?) +(.*))$/m;
const extractDefineRegex = /#define *([^ ]+)+ *([^ ]+)+/;

export class Define extends BaseEntity {
  override readonly type = "define";

  protected getDependencyTestString(): string {
    const [, , value] = this.definition.match(extractDefineRegex)!;
    return value;
  }

}
