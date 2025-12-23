import { BaseEntity } from "./base-entity.js";

export const uniformRegex = /(uniform\s+(\w+)[\w\[\]]*\s+(\w+)[\w\[\]]*\s*;)/;

export class Uniform extends BaseEntity {
  override readonly type = "uniform";

  protected getDependencyTestString(): string {
    const [, , type] = this.definition.match(uniformRegex)!;

    return type;
  }

}
