import { describe, expect, it } from "vitest";
import { GLSLRegistry } from "../src/core-system";
import { constantsLibrary, noiseLibrary, randomLibrary, utilitiesLibrary } from "./test-libraries";
import { getShaderValidator } from "./shader-validator";
import { validShader, nonexistentPathImportShader, nonexistentEntityImportShader, importingUnexportedShader } from "./shaders";

describe("resolving shaders", async () => {
  const shaderValidator = await getShaderValidator();

  const registry = new GLSLRegistry({
    libraries: [constantsLibrary, randomLibrary, noiseLibrary, utilitiesLibrary]
  });

  it("Resolves shader imports", async () => {
    const resolvedShader = registry.resolve(validShader);

    ["PI", "TWO_PI", "GOLDEN_RATIO", "random", "random2", "random3", "valueNoise3"].forEach((fn) =>
      expect(resolvedShader).toMatch(new RegExp(`\\b${fn}\\b`))
    );

    const validationResult = await shaderValidator?.validate(resolvedShader, "fragment")
    expect(validationResult).toBe("");
  });

  it("Tries to import from path that does not exist", () => {
    expect(() => registry.resolve(nonexistentPathImportShader)).toThrowError(`No module "random" in library random`);
  });

  it("Tries to import entity that does not exist", () => {
    expect(() => registry.resolve(nonexistentEntityImportShader)).toThrowError(`No export "rotate" in module random/1d`);
  });

  it("Tries to import entity that is not exported", () => {
    expect(() => registry.resolve(importingUnexportedShader)).toThrowError(`No export "hash" in module random/1d`);
  });

  await shaderValidator?.close();
});

