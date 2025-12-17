import { describe, expect, it } from "vitest";
import { GLSLRegistry } from "../src/core-system";
import { constantsLibrary, noiseLibrary, randomLibrary } from "./test-libraries";
import { getShaderValidator } from "./shader-validator";

describe("resolving shaders", async () => {
  const { validShader, nonexistentPathImportShader, nonexistentEntityImportShader, importingUnexportedShader } = getShaders();

  const shaderValidator = await getShaderValidator();

  const registry = new GLSLRegistry({
    libraries: [constantsLibrary, randomLibrary, noiseLibrary]
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

function getShaders() {
  const validShader = `
  #version 300 es

  precision highp float;

  in vec2 uv;
  out vec4 color;

  import { TWO_PI, GOLDEN_RATIO } from "constants";
  import { random2 } from "random/2d";
  import { random } from "random/1d";
  import { valueNoise3 } from "noise/value";

  void main() {
    float value1 = TWO_PI*random(uv);
    vec2 value2 = GOLDEN_RATIO*random2(uv);
    vec3 value3 = valueNoise3(uv, 0.1, 1.0);
    color = vec4(value3 + vec3(value1, value2), 1.0);
  }
  `.trim();

  const nonexistentPathImportShader = `
  import { random } from "random";

  void main() {
    vec2 value = random(vec2(1, 0));
  }
  `

  const nonexistentEntityImportShader = `
  import { rotate } from "random/1d";

  void main() {
    vec2 value = rotate(vec2(1, 0), 0.78);
  }
  `

  const importingUnexportedShader = `
  import { hash } from "random/1d";

  void main() {
    uint value = hash(1u);
  }
  `

  return { validShader, nonexistentPathImportShader, nonexistentEntityImportShader, importingUnexportedShader };

}
