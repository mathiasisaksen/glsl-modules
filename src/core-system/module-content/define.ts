import { ModuleEntity } from "./module-entity.js";

export const defineRegex = /^ *(#define +(\w+(?:\([^\)]*\))?) +(.*))$/m;
const extractDefineRegex = /#define *([^ ]+)+ *([^ ]+)+/;

export class Define extends ModuleEntity {
  protected getDependencyTestString(): string {
    const [, , value] = this.definition.match(extractDefineRegex)!;
    return value;
  }

}
