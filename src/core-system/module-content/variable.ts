import { ModuleEntity } from "./module-entity.js";

export const variableRegex = /\s*((?:const\s+)?(\w+)\s+(\w+)\s+=\s+(\S+)\s*;)(?![^{]*})/;

export class Variable extends ModuleEntity {

  protected getDependencyTestString(): string {
    const [, , type, , value] = this.definition.match(variableRegex)!;

    return type + " " + value;
  }  

}
