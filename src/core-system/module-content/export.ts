
export const exportsRegex = /^ *export\s*{([^}]+)} *;?\s*$/m;

export const exportQualifiers = ["internal"] as const;

export type ExportQualifier = typeof exportQualifiers[number];

export class Export {
  name: string;
  qualifier?: ExportQualifier;

  constructor(name: string, qualifier?: ExportQualifier) {
    this.name = name;
    this.qualifier = qualifier;
  }

}
