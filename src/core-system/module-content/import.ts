
export const importRegex = /import\s*{\s*([^}]*)}\s*from\s+(["'`]?)([^\s"'`]+)\2;?/;
export const extractImportDataRegex = /^(\w+)(?:\s+as\s+(\w+))?$/m;

export class Import {
  id: string;
  name: string;
  path: string;

  alias?: string;

  constructor(name: string, path: string, alias?: string) {
    this.id = `${path}/${name}`;
    this.name = name;
    this.path = path;
    this.alias = alias;
  }

}
