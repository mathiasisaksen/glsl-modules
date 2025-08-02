import { findClosingIndex, blankOutSubstring, commaSeparatedSplitRegex, matchIterator, Match } from "../utils/index.js";
import { GLSLLibrary } from "./glsl-library.js";
import { Define, EntityDependency, Export, Argument, Func, Import, ModuleEntity, Struct, Variable, variableRegex, functionSignatureRegex, structRegex, defineRegex, importRegex, extractImportDataRegex, exportsRegex, exportQualifiers, ExportQualifier } from "./module-content/index.js";

export class GLSLParser {
  originalCode: string;
  path: string;

  imports: Import[] = [];
  exports: Export[] = [];
  
  entities: ModuleEntity[] = [];

  code: string;

  constructor(code: string, path: string) {
    this.originalCode = code;
    this.code = String(code);
    this.path = path;
    
  }

  parseAll() {
    this.parseImports();
    this.parseExports();
    this.parseFunctions();
    this.parseVariables();
    this.parseStructs();
    this.parseDefines();

    return this;
  }

  parseFunctions() {
    let functions: Func[] = [];

    while (true) {
      const match = Match.new(this.code, functionSignatureRegex);

      if (!match) break;

      const { startIndex } = match;
      const endIndex = findClosingIndex(this.code, startIndex);

      const [signature, returnType, name, argsString] = match.groups;
      const definition = this.code.slice(startIndex, endIndex);
      const args = Argument.parseArgumentsString(argsString);
      functions.push(new Func(name, this.path, startIndex, definition, args));

      this.code = blankOutSubstring(this.code, startIndex, endIndex);
    }

    this.entities.push(...functions);
    
    return functions;
  }

  parseVariables() {
    let variables: Variable[] = [];

    for (const match of matchIterator(this.code, variableRegex)) {
      const [definition, type, name, value] = match.groups;
      const { startIndex, endIndex } = match;

      variables.push(new Variable(name, this.path, startIndex, definition));

      this.code = blankOutSubstring(this.code, startIndex, endIndex);
    }

    this.entities.push(...variables);

    return variables;
  }

  parseStructs() {
    let structs: Struct[] = [];

    for (const match of matchIterator(this.code, structRegex)) {
      const [definition, name, fieldsString] = match.groups;
      const { startIndex, endIndex } = match;

      const fields = fieldsString
        .trim()
        .split(/\s*;\s*/)
        .filter((field) => field);

      const args = Argument.parse(fields);

      structs.push(new Struct(name, this.path, startIndex, definition, args));
      
      this.code = blankOutSubstring(this.code, startIndex, endIndex);
    };

    this.entities.push(...structs);

    return structs;
  }

  parseDefines() {
    const defines: Define[] = [];

    for (const match of matchIterator(this.code, defineRegex)) {
      const [definition, name, value] = match.groups;
      const { startIndex, endIndex } = match;

      defines.push(new Define(name, this.path, startIndex, definition));

      this.code = blankOutSubstring(this.code, startIndex, endIndex);
    }

    this.entities.push(...defines);

    return defines;
  }

  parseImports() {
    const imports: Import[] = [];

    const currentLibraryName = GLSLLibrary.extractLibraryNameFromPath(this.path);

    for (const match of matchIterator(this.code, importRegex)) {
      const { selection, startIndex, endIndex } = match;
      let [importsString, , path] = match.groups;

      if (!importsString) throw new Error(`Missing imports in ${selection}`);
      if (!path) throw new Error(`Missing import path in ${selection}`);

      path = path.replace("@", currentLibraryName);

      const importEntries = importsString.trim().split(commaSeparatedSplitRegex).filter((entry) => entry);

      for (const entry of importEntries) {
        const extractMatch = Match.new(entry, extractImportDataRegex);

        if (!extractMatch) throw new Error(`Invalid import: ${entry}`);

        const [name, alias] = extractMatch.groups;
        imports.push(new Import(name, path, alias));
      }

      this.code = blankOutSubstring(this.code, startIndex, endIndex);
      
    }

    this.imports = imports;

    return imports;
  }

  parseExports() {
    for (const match of matchIterator(this.code, exportsRegex)) {
      const [exportString] = match.groups;
      const { startIndex, endIndex } = match;

      this.code = blankOutSubstring(this.code, startIndex, endIndex);

      const exportEntries = exportString.trim().split(commaSeparatedSplitRegex).filter((entry) => entry);

      const extractExportFieldRegex = /^(?:(\w+) +)?(\w+)(?: +as +(\w+))?$/;

      const exports = exportEntries.map((entry) => {
        const extractMatch = Match.new(entry, extractExportFieldRegex);

        if (!extractMatch) throw new Error(`Invalid export entry: ${entry}`);

        const [qualifier, name, alias] = extractMatch.groups;


        if (alias) {
          if (this.code.match(new RegExp(`\\b${alias}\\b`)) !== null) throw new Error(`Export alias "${alias}" exists in same module`);
      
          this.code = this.code.replaceAll(new RegExp(`\\b${name}\\b`, "g"), alias);
        }

        if (qualifier && !exportQualifiers.some((q) => q === qualifier)) throw new Error(`Invalid export qualifier "${qualifier}"`);

        return new Export(name, qualifier as ExportQualifier);
      });

      this.exports.push(...exports);
    }
  }

  determineDependencies() {
    const { entities, imports } = this;

    const candidateDependencies = getCandidateDependencies(entities, imports);
    
    for (const entity of entities) entity.determineDependencies(candidateDependencies);
  
    return this;
  }
 
}

function getCandidateDependencies(entities: ModuleEntity[], imports: Import[]) {
  const candidateDependencies: EntityDependency[] = [];
  const seenIds = new Set<string>();
  
  for (const { id, name, path } of entities) {
    if (seenIds.has(id)) continue;
    candidateDependencies.push(new EntityDependency(name, path, "ambient"));
    seenIds.add(id);
  }

  for (const { id, name, path, alias } of imports) {
    if (seenIds.has(id)) continue;
    candidateDependencies.push(new EntityDependency(name, path, "import", alias));
    seenIds.add(id);
  }

  return candidateDependencies;
}