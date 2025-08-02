
type EntityDependencyType = "import" | "ambient";

export class EntityDependency {
  id: string;
  name: string;
  path: string;
  type: EntityDependencyType;
  
  alias?: string;
  localName: string;

  constructor(name: string, path: string, type: EntityDependencyType, alias?: string) {
    this.id = `${path}/${name}`;
    this.name = name;
    this.path = path;
    this.type = type;
    this.alias = alias;
    this.localName = alias ?? name;
  }

  isDependencyOf(string: string) {
    return string.match(new RegExp(`\\b${this.localName}\\b`)) !== null;
  }

}
