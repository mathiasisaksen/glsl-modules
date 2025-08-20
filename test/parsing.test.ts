import { GLSLParser } from './../src/core-system/glsl-parser';
import { describe, expect, it } from "vitest";
import { BaseEntity, Func, Struct, Variable } from '../src/core-system/module-content';

describe("Parsing code", () => {
  const { exhaustiveFragmentShader, exhaustiveVertexShader, validFragmentShader } = getShaders();

  it("Attempts parsing exhaustive fragment shader", () => {
    new GLSLParser(exhaustiveFragmentShader, "fragment-shader")
      .parseAll();
  });

  it("Attempts parsing exhaustive vertex shader", () => {
    new GLSLParser(exhaustiveVertexShader, "vertex-shader")
      .parseAll();
  });

  it("Parses fragment shader and validates content", () => {
    const parser = new GLSLParser(validFragmentShader, "fragment-shader")
      .parseAll()
      .determineDependencies();

    const { imports, exports, entities } = parser;

    // Are imports are parsed correctly?
    expect(imports).toHaveLength(3);

    const [functionImport, variableImport] = imports;

    expect(functionImport.id).toBe("some-library/computeSomething");
    expect(functionImport.name).toBe("computeSomething");
    expect(functionImport.alias).toBe("compute");
    expect(variableImport.alias).toBeUndefined();

    // Are exports are parsed correctly?
    expect(exports).toHaveLength(2);

    const [functionExport, variableExport] = exports;

    expect(functionExport.name).toBe("f");
    expect(functionExport.qualifier).toBe("internal");
    expect(variableExport.qualifier).toBeUndefined();

    // Is content parsed correctly?
    expect(entities).toHaveLength(3);
    expect(entities.every(entity => entity instanceof BaseEntity));
    
    const [func, variable, struct] = entities;

    expect(func).toBeInstanceOf(Func);
    expect(func.key).toBe("fragment-shader/f:Data");
    expect(func.dependencies).toHaveLength(4);

    const dependencyIds = func.dependencies.map(dep => dep.id).sort();
    expect(dependencyIds).toEqual([
      "fragment-shader/Data",
      "fragment-shader/PI",
      "other-library/some-module/Return",
      "some-library/computeSomething"
    ]);
    expect(func.definition).toMatch(/^\w+\s+\w+\(.*\)\s*{[\s\S]*}$/);

    expect(variable).toBeInstanceOf(Variable);
    expect(variable.key).toBe("fragment-shader/PI");
    expect(variable.definition).toMatch(/^(const\s+)?\w+\s+\w+\s*=\s*[\s\S]+;$/);

    expect(struct).toBeInstanceOf(Struct);
    expect(struct.key).toBe("fragment-shader/Data");
    expect(struct.definition).toMatch(/^struct\s+\w+\s*{[\s\S]+};$/);

  });
});

function getShaders() {
  // Vertex shader that contains all GLSL features supported by library
  const exhaustiveVertexShader = /*glsl*/`
  #version 300 es

  layout(location = 0) in vec3 inPosition;
  layout(location = 1) in vec3 inNormal;
  layout(location = 2) in vec2 inUV;
  layout(location = 3) in vec4 inColor;

  out vec3 vWorldPos;
  out vec3 vNormal;
  flat out int vFlatFlag;
  out vec2 vUV;

  uniform mat4 model;
  uniform mat4 view;
  uniform mat4 proj;
  uniform int someValue;

  vec3 transformPos(mat4 m, vec3 p) {
      return (m * vec4(p, 1.0)).xyz;
  }

  void main() {
      vec3 pos = transformPos(model, inPosition);
      vWorldPos = pos;
      vNormal = mat3(transpose(inverse(model))) * inNormal;
      vFlatFlag = int(gl_VertexID % 2);
      vUV = inUV;

      float scale = 1.0;
      for (int i = 0; i < someValue; ++i) {
          scale *= 1.0 + 0.01 * float(i);
          if (scale > 2.0) break;
      }

      gl_Position = proj * view * vec4(pos * scale, 1.0);
      gl_PointSize = 5.0; // valid in WebGL2 vertex shaders
  }

  `.trim();

  // Fragment shader that contains all GLSL features supported by library
  const exhaustiveFragmentShader = /*glsl*/`
  #version 300 es
  precision highp float;

  // Input from vertex shader
  in vec3 vWorldPos;
  in vec3 vNormal;
  flat in int vFlatFlag;
  in vec2 vUV;

  // Output color
  out vec4 outColor;

  // Samplers (WebGL2 allows multiple sampler types)
  uniform sampler2D texDiffuse;
  uniform samplerCube envMap;

  void main() {
      vec4 diffuseTex = texture(texDiffuse, vUV);
      vec4 envSample = texture(envMap, normalize(vWorldPos));

      // Derivatives (valid in fragment shader)
      float fx = dFdx(vUV.x);
      float fy = dFdy(vUV.y);
      float f = fwidth(vUV.x);

      vec3 lighting = normalize(vNormal) * 0.5 + 0.5;
      vec4 litColor = vec4(lighting, 1.0);

      // Simple discard example
      if (diffuseTex.a < 0.1) discard;

      outColor = mix(diffuseTex, litColor + envSample * 0.2, 0.5);
  }

  `.trim();

  const validFragmentShader = /*glsl*/`
  #version 300 es

  /**
   * A block comment describing the shader
   */

  import {
    computeSomething as compute,
    someConstant,
  } from "some-library";

  import { Return } from "other-library/some-module"

  export {
    internal foo as f,
    PI
  };

  const float PI = 3.14159265;

  Return foo(Data data) {
    if (data.a > 0.5) {
      return Return(0.0);
    }
    
    float value = compute(123.0); // A line comment
    return Return(PI*value);
  }

  struct Data {
    float a;
    int b;
    mat2x2 c;
  };

  `.trim();

  return { exhaustiveFragmentShader, exhaustiveVertexShader, validFragmentShader }
}