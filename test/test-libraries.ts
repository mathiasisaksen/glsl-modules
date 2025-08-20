import { GLSLLibrary } from "../src/core-system/glsl-library.js"

export const constantsLibrary = new GLSLLibrary({
  name: "constants",
  definition: {
    "@index": `
    export { PI, TWO_PI, HALF_PI, INV_PI, INV_TWO_PI, E, GOLDEN_RATIO }    

    const float PI = 3.1415926535897932;
    const float TWO_PI = 2.0*PI;
    const float HALF_PI = 0.5*PI;
    const float INV_PI = 1.0/PI;
    const float INV_TWO_PI = 1.0/TWO_PI;
    const float E = 2.7182818284590452;
    const float GOLDEN_RATIO = 1.6180339887498948;
    `
  }
});

const random1dDefinition = /*glsl*/`
export { random };

uint hash(uint value) {
  value ^= value >> 16;
  value *= 569420461u;
  value ^= value >> 15;
  value *= 3545902487u;
  value ^= value >> 15;
  return value;
}

uint hash(uvec2 v) {
  return hash(v.x ^ hash(v.y));
}

uint hash(uvec3 v) {
  return hash(v.x ^ hash(v.y ^ hash(v.z)));
}

uint hash(uvec4 v) {
  return hash(v.x ^ hash(v.y ^ hash(v.z ^ hash(v.w))));
}

uint hash(uvec4 v, uint u) {
  return hash(v.x ^ hash(v.y ^ hash(v.z ^ hash(v.w ^ hash(u)))));
}

float hashToFloat(uint u) {
  uint mant = 8388607u;
  uint one = 1065353216u;

  u &= mant;
  u |= one;

  float f = uintBitsToFloat(u);
  return f - 1.0;
}

float random(float p) {
  return hashToFloat(hash(floatBitsToUint(p)));
}

float random(vec2 p) {
  return hashToFloat(hash(floatBitsToUint(p)));
}

float random(vec3 p) {
  return hashToFloat(hash(floatBitsToUint(p)));
}

float random(vec4 p) {
  return hashToFloat(hash(floatBitsToUint(p)));
}

float random(float p, float seed) {
  return random(vec2(p, seed));
}

float random(vec2 p, float seed) {
  return random(vec3(p, seed));
}

float random(vec3 p, float seed) {
  return random(vec4(p, seed));
}

float random(vec4 p, float seed) {
  return hashToFloat(hash(floatBitsToUint(p), floatBitsToUint(seed)));
}
`

const random2dDefinition = /*glsl*/`
import { random } from "@/1d";
export { random2 }

vec2 random2(float p, float seed) {
  return vec2(random(vec3(p, seed, 0), random(vec3(p, seed, 1))));
}

vec2 random2(float p) {
  return random2(p, 0.);
}

vec2 random2(vec2 p, float seed) {
  return vec2(random(vec4(p, seed, 0)), random(vec4(p, seed, 1)));
}

vec2 random2(vec2 p) {
  return random2(p, 0.0);
}

vec2 random2(vec3 p, float seed) {
  return vec2(random(vec4(p, seed), 0.), random(vec4(p, seed), 1.));
}

vec2 random2(vec3 p) {
  return random2(p, 0.0);
}
`

const random3dDefinition = /*glsl*/`
import { random } from "@/1d";
export { random3 }

vec3 random3(float p, float seed) {
  return vec3(random(vec3(p, seed, 0)), random(vec3(p, seed, 1)), random(vec3(p, seed, 2)));
}

vec3 random3(float p) {
  return random3(p, 0.0);
}

vec3 random3(vec2 p, float seed) {
  return vec3(random(vec4(p, seed, 0)), random(vec4(p, seed, 1)), random(vec4(p, seed, 2)));
}

vec3 random3(vec2 p) {
  return random3(p, 0.0);
}

vec3 random3(vec3 p, float seed) {
  return vec3(random(vec4(p, seed), 0.0), random(vec4(p, seed), 1.0), random(vec4(p, seed), 2.0));
}
`

export const randomLibrary = new GLSLLibrary({
  name: "random",
  definition: {
    "1d": random1dDefinition,
    "2d": random2dDefinition,
    "3d": random3dDefinition,
  }
});

const valueNoiseDefinition = `
import { random3 } from "random/3d";
export { valueNoise3 };

vec3 valueNoise3(vec2 p, float scale, float seed) {
  p /= scale;

  vec2 pi = floor(p);
  vec2 pf = fract(p);

  vec2 sf = smoothstep(0.0, 1.0, pf);
  vec2 o = vec2(1, 0);

  return mix(
    mix(random3(pi, seed), random3(pi + o.xy, seed), sf.x),
    mix(random3(pi + o.yx, seed), random3(pi + o.xx, seed), sf.x),
    sf.y
  );

}

`;

export const noiseLibrary = new GLSLLibrary({
  name: "noise",
  definition: {
    value: valueNoiseDefinition
  },
  dependencies: [randomLibrary]
});