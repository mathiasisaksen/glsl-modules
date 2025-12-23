import { BaseEntity } from "./base-entity.js";

export const variableRegex = /((?:const\s+)?(\w+)[\w\[\]]*\s+(\w+)[\w\[\]]*\s+=\s+([^;]+)\s*;)(?![^{]*})/;

export class Variable extends BaseEntity {
  override readonly type = "variable";

  protected getDependencyTestString(): string {
    const [, , type, , value] = this.definition.match(variableRegex)!;

    return type + " " + value;
  }

}
