
export const validShader = `
  #version 300 es

  precision highp float;

  in vec2 uv;
  out vec4 color;

  import { TWO_PI, GOLDEN_RATIO } from "constants";
  import { random2 } from "random/2d";
  import { random } from "random/1d";
  import { valueNoise3 } from "noise/value";
  import { Ray } from "utilities";

  uniform Ray ray;

  void main() {
    vec3 origin = ray.origin;
    float value1 = TWO_PI*random(uv);
    vec2 value2 = GOLDEN_RATIO*random2(uv);
    vec3 value3 = valueNoise3(uv, 0.1, 1.0);
    color = vec4(value3 + vec3(value1, value2), 1.0);
  }
  `.trim();

export const nonexistentPathImportShader = `
  import { random } from "random";

  void main() {
    vec2 value = random(vec2(1, 0));
  }
  `

export const nonexistentEntityImportShader = `
  import { rotate } from "random/1d";

  void main() {
    vec2 value = rotate(vec2(1, 0), 0.78);
  }
  `

export const importingUnexportedShader = `
  import { hash } from "random/1d";

  void main() {
    uint value = hash(1u);
  }
  `

