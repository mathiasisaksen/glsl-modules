import { BaseEntity } from "./base-entity.js";

export const variableRegex = /\s*((?:const\s+)?(\w+)\s+(\w+)\s+=\s+(\S+)\s*;)(?![^{]*})/;

export class Variable extends BaseEntity {
  override readonly type = "variable";

  protected getDependencyTestString(): string {
    const [, , type, , value] = this.definition.match(variableRegex)!;

    return type + " " + value;
  }  

}
