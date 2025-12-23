
import { BaseEntity } from "./base-entity.js";
import { commaSeparatedSplitRegex } from "../../utils/regexes.js";

export const functionSignatureRegex = /((\w+)\s+(\w+)\s*\(([^\)]*)\))(?:\s*\{)/;

const plainArgumentExtractRegex = /(\w+)\s+(\w+)/;

export class Argument {
  name: string;
  type: string;
  index: number;

  constructor(name: string, type: string, index: number) {
    this.name = name;
    this.type = type;
    this.index = index;
  }

  static parse(args: Array<string>) {
    return args.map((arg, i) => {
      const argumentMatch = arg.match(plainArgumentExtractRegex);

      if (!argumentMatch) throw new Error(`Invalid argument format: ${arg}`);

      const [, type, name] = argumentMatch;

      return new Argument(name, type, i);
    });
  }

  static parseArgumentsString(code: string) {
    if (code.length === 0) return [];

    const argList = code.split(commaSeparatedSplitRegex);

    return Argument.parse(argList);
  }
}

export class Func extends BaseEntity {
  override readonly type = "function";
  arguments: Array<Argument>;

  constructor(name: string, path: string, index: number, definition: string, args: Array<Argument>) {
    super(name, path, index, definition);
    this.arguments = args;
    this.key = `${this.id}:${args.map(({ type }) => type).join(",")}`;
  }

  protected getDependencyTestString(): string {
    const { definition } = this;
    const extractTypeAndBodyRegex = /(\w+)[^{]+{([\s\S]+)}/;
    const match = this.definition.match(extractTypeAndBodyRegex);

    if (!match) throw new Error(`Unable to extract function body from ${definition}`);

    // Dependencies will either be used as a return type, parameter type or in the function body
    const [, type, body] = match;
    const argString = this.arguments.map((arg) => arg.type).join(",");

    return [type, argString, body].join(" ");
  }

}
