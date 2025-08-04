<div align="center">
  <img src="https://st4yho.me/wp-content/uploads/2025/08/glsl-modules-code.png" width="450" alt="glsl-modules code example" />
</div>


# <img src="https://st4yho.me/wp-content/uploads/2025/08/logo.svg" width="90" align="center" alt="glsl-modules icon">&nbsp;&nbsp;&nbsp;glsl-modules

[![npm version](https://img.shields.io/npm/v/glsl-modules.svg)](https://www.npmjs.com/package/glsl-modules)

**glsl-modules** is a GLSL preprocessor for JavaScript/TypeScript that extends GLSL with client-side module import/export functionality and a plugin system for custom syntax.
This means that the shaders are dynamically built and resolved at run time, not at build time.

Interested in seeing it in action and trying it out for yourself?
Check out the glsl-modules playground: https://glsl-modules.vercel.app

The library is still a work in progress, and the API is subject to change.

### Contents:
* [Installation](#installation)
* [Examples](#examples)
  * [Example shader](#example-shader)
  * [Resolving a shader](#resolving-a-shader)
  * [Defining a library](#defining-a-library)
  * [Defining a plugin](#defining-a-plugin)
* [Available plugins](#available-plugins)
  * [arrow-functions](#arrow-functions)
  * [function-as-argument](#function-as-argument)
  * [named-arguments](#named-arguments)
  * [namespaced-imports](#namespaced-imports)
  * [css-colors](#css-colors)

## Installation
The library is available on npm:

```bash
npm install glsl-modules
```


## Examples
**Note**: The GLSL code snippets below are simplified, missing version directives and so on.

### Example shader
Here is a typical `glsl-modules` shader, showcasing both imports and custom syntax handled by a plugin:

```ts
const fragmentShader = /*glsl*/`
import { randomColor } from "random/color"

in vec2 uv;
out vec4 color;

vec3 baseColor = css-red; // requires css-color-plugin!

void main() {
  vec3 randomColor = randomColor(uv);
  vec3 gradientColor = mix(baseColor, randomColor, uv.x);
  color = vec4(gradientColor, 1);
}
`
```

It imports the function `randomColor` from the module `color` in the library `random`.

### Resolving a shader

The `fragmentShader` defined above must be resolved to a valid GLSL shader before use.
There are two ways to achieve this:
1. with a `GLSLRegistry` (recommended) - can be reused to resolve multiple shaders, avoids repeating setup
2. with `resolveGLSL` - for resolving a single shader

First, using `resolveGLSL`:
```ts
import { resolveGLSL } from "glsl-modules";
import { randomLibrary } from "./random-library";
import { cssColorsPlugin } from "glsl-modules/plugins";

const resolvedFragmentShader = resolveGLSL(fragmentShader, { 
  libraries: [randomLibrary],
  plugins: [cssColorsPlugin()]
});
```

With a `GLSLRegistry`:

```ts
const registry = new GLSLRegistry({
  libraries: [randomLibrary],
  plugins: [cssColorsPlugin()]
});

const resolvedVertexShader = registry.resolve(vertexShader);
const resolvedFragmentShader = registry.resolve(fragmentShader);
```

When resolving, `glsl-modules` constructs a new shader string that contains the imported content in the correct order, and applies the activated plugins.
For `fragmentShader`, that might look something like this:

```glsl
in vec2 uv;
out vec4 color;

vec3 baseColor = vec3(1, 0, 0);

float random(vec2 position, float seed) {
  // This is bad on purpose, just a placeholder
  return fract(dot(position, vec2(123, 987)) + seed);
}

vec3 randomColor(vec2 position) {
  return vec3(random(position, 0.0), random(position, 1.0), random(position, 2.0));
}

void main() {
  vec3 randomColor = randomColor(uv);
  vec3 gradientColor = mix(baseColor, randomColor, uv.x);
  color = vec4(gradientColor, 1);
}
```

The `random` function was not explicitly imported, but is included since `randomColor` depends on it.

### Defining a library

A library is a collection of modules, where the content of each module is defined as a string of GLSL code.
A module consists of entities like functions, variables and structs, which can be exported and made available outside the module.

A module can import content from other modules, and the shorthand @ is used when importing from a module inside the same library.

Here is an example library `utilities`, which has the library `random` as a dependency:
```ts
import { randomLibrary } from "./random-library";

const rotationDefinition = /*glsl*/`
export { rotate }

vec2 rotate(vec2 p, float rotation) {
  return mat2(cos(rotation), sin(rotation), -sin(rotation), cos(rotation))*p;
}`

const miscellaneousDefinition = /*glsl*/`
// internal = only available for modules in same library
export { PI, internal ColorData }

float PI = 3.14159265358;
struct ColorData {
  vec3 color;
  vec2 position;
};`

const grainDefinition = /*glsl*/`
import { ColorData as CD } from "@/miscellaneous" // From same library
import { random } from "random/1d" // From dependency

export { grain as addGrain } // Aliased export

vec3 grain(CD data, float amount) {
  return data.color + amount*(-1.0 + 2.0*random(data.position));
}`

const utilitiesLibrary = new GLSLLibrary({
  name: "utilities",
  definition: {
    // Module utilities/rotation
    "rotation": rotationDefinition,
    // Module utilities/miscellaneous
    "miscellaneous": miscellaneousDefinition,
    // Module utilities/grain
    "grain": grainDefinition,
  },
  dependencies: [randomLibrary]
});
```

More complex library structures can be achieved by nesting objects, like in this imagined `noise` library:
```ts
const noiseDefinition = {
  "@index": "",   // noise
  "1d": {
    "@index": ""  // noise/1d
    "value": "",  // noise/1d/value
    "perlin": "", // noise/1d/perlin
    "worley": "", // noise/1d/worley
  },
  "2d": {
    "value": "",  // noise/2d/value
    "perlin": "", // noise/2d/perlin
  },
  "3d": {
    "value": "",  // noise/3d/value
    "perlin": "", // noise/3d/perlin
  }
}

```

### Defining a plugin

Plugins are used to modify the contents of library modules and shader code.
There are three stages: preprocess, transform, and postprocess. 

**preprocess**: modifies the raw string definition of an entire module/shader before parsing.

Example: A plugin that ensures that the code string starts with `#version 300 es`, which is required in WebGL2.
However, this check is only necessary for shader output, not module definitions.
The parameter `isShader` can be used to check this:
```ts
import { GLSLPlugin } from "glsl-modules";

function versionStringPlugin(): GLSLPlugin {
  const versionString = "#version 300 es";
  return {
    id: "version-string",
    preprocess: (code, isShader) => {
      if (isShader && !code.startsWith(versionString)) {
        return versionString + "\n" + code;
      } else {
        return code;
      }
    }
  }
}
```

**transform**: modifies the content of entities after parsing into the internal representation


**postprocess**: modifies the raw string definition of entities after the previous stages

The following plugin adds a comment containing the unique key (path + entity name + arguments for functions) of the entity to the start of the definition (e.g. `/* libraryName/moduleName/functionName */`):
```ts
import { definePlugin } from "glsl-modules";

const includeKeyOfEntityPlugin = definePlugin(() => ({
  id: "include-key-of-entity",
  postprocess: (code, entity) => {
    return `/* ${entity.key} */\n` + code;
  }
}));
```


## Available plugins
The following plugins have been implemented and are included in the library.

### arrow-functions

Adds support for JS-like arrow functions, which can be defined both globally and inside another function.
In the latter case, the arrow function is only available inside its parent function.
Note that the arrow function does not have access to other data defined in the same scope.

For short, single-line functions the syntax is `returnType name = (arguments) => expression;`, and the return keyword is omitted:
```glsl
float sumOfCubes(float a, float b) {
  float cube = (float x) => x*x*x;

  float aCubed = cube(a);
  float bCubed = cube(b);

  return aCubed + bCubed;
}
```

For larger, multi-line functions the syntax is `returnType name = (arguments) => { functionBody }`:

```glsl
void main = () => {
  vec3 cubedColor = pow(uv.xyx, vec3(3.0));
  color = vec4(cubedColor, 1);
}
```

In situations where an anonymous arrow function is needed, the syntax is `returnType (arguments) => expression`, e.g. `float (float x) => exp(x)`.

### function-as-argument
Implements higher-order functions, i.e. functions that take other functions as arguments.
For example, a function that estimates the derivative of `f`:

```glsl
float derivative(float f(float), float x, float h) {
  return (f(x + h) - f(x - h))/(2.0*h);
}
```

which can be used with some predefined function:

```glsl
float df = derivative(someFunction, 0.5, 1e-4);
```

or, when combined with `arrow-functions`, an anonymous arrow function:

```glsl
float df = derivative(float (float x) => x*x, 0.5, 1e-4);
```

### named-arguments
Makes it possible to specify arguments in a JS object-like fashion, both when calling functions and creating structs.
Useful when a function has many arguments, to avoid constantly looking up its definition.

The arguments can be specified in any order:

```glsl
float foo(vec3 position, float size, int octaves, bool includeStart, float window) {
  // insert definition
}

float size = 0.2;
float result = foo({
  position: vec3(1, 0, 2),
  size,
  window: 0.4,
  octaves: 4,
  includeStart: true,
});
```

Note: For now, only user-defined functions are supported. Something like `step({ x: 0.5, edge: 1.0 })` will not work.

### namespaced-imports
Import and make an entire path available as a namespace:

```glsl
import "utilities/math" as m;

vec3 foo(vec3 position) {
  // Function axisAngle in module utilities/math/rotation
  return m.rotation.axisAngle(position, vec3(1), 0.4);
}
```

### css-colors
Write CSS colors directly in code.
Should support any format, here are some examples:

```glsl
vec3 namedColor = css-rebeccaPurple; // Must be prefixed with css-

vec3 hexColor = #FF0FAB;
vec4 hexAlphaColor = #0F04;

vec3 rgbColor = rgb(31 120 50);
vec4 rgbaColor = rgb(0 0 255 / 50%);

vec3 hslColor = hsl(from red calc(h + 90) s l);
vec4 hslaColor =  hsl(0.3turn 60% 45% / 0.7);

vec3 hwbColor = hwb(200 0% 0%);
vec4 hwbAlphaColor = hwb(200 0% 0% / 0.5);

vec3 lchColor = lch(52% 40 120);
vec4 lchAlphaColor = lch(52% 40 120 / 0.8);

vec3 oklchColor = oklch(0.7 0.15 120);
vec4 oklchAlphaColor = oklch(0.7 0.15 120 / 0.6);

vec3 labColor = lab(60% 20 -30);
vec4 labAlphaColor = lab(60% 20 -30 / 0.9);

vec3 oklabColor = oklab(0.65 0.1 -0.05);
vec4 oklabAlphaColor = oklab(0.65 0.1 -0.05 / 0.7);

vec3 colorSpaceColor = color(display-p3 1 0.5 0.2);
vec4 colorSpaceAlphaColor = color(srgb 0.2 0.4 0.6 / 0.3);

```
