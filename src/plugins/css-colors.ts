
/**
 * Plugin that allows user to write colors in a variety of formats
 * (hex triplet, HSL, RGB etc)
 * Use CSS as inspiration?
 */

import { GLSLPlugin } from "../core-system/glsl-plugin.js";
import { findClosingIndex } from "../utils/find-closing-index.js";
import { matchIterator } from "../utils/match-iterator.js";

const pluginId = "css-colors";
const colorStringFormats = ["named", "hex", "rgb", "hsl", "hwb", "lch", "oklch", "lab", "oklab", "color"] as const;
type ColorStringFormat = typeof colorStringFormats[number];

const formatRegexMap: Record<ColorStringFormat, RegExp> = {
  "named": /\bcss-([a-z]+)\b/i,
  "hex": /#(?:(?:[0-9a-z]{3,4})|(?:[0-9a-z]{2}){3,4})\b/i,
  "rgb": /\brgba?\(/i,
  "hsl": /\bhsla?\(/i,
  "hwb": /\bhwb\(/i,
  "lch": /\blch\(/i,
  "oklch": /\boklch\(/i,
  "lab": /\blab\(/i,
  "oklab": /\boklab\(/i,
  "color": /\bcolor\(/i,
}

type ParsedColor = {
  selection: string;
  cssString: string;
  startIndex: number;
  endIndex: number;
  hasAlpha: boolean;
}

type ColorStringsOptions = {
  formats?: Array<ColorStringFormat>;
}

export function cssColorsPlugin(options: ColorStringsOptions = {}): GLSLPlugin {
  const formats = new Set(options.formats ?? colorStringFormats);

  return {
    id: pluginId,
    preprocess(code) {
      let parsedColors: Array<ParsedColor> = [];

      for (const format of formats) {
        if (format === "named") {
          for (const match of matchIterator(code, formatRegexMap.named)) {
            const { selection, groups, startIndex, endIndex } = match;
            const color = groups[0];
            parsedColors.push({ selection, cssString: color, hasAlpha: false, startIndex, endIndex });
          }
        } else if (format === "hex") {
          for (const match of matchIterator(code, formatRegexMap.hex)) {
            const { selection, startIndex, endIndex } = match;

            if (selection === "#define") continue;

            const { length } = selection;

            parsedColors.push({ selection, cssString: selection, hasAlpha: length === 5 || length === 9, startIndex, endIndex });
          }
        } else {
          for (const match of matchIterator(code, formatRegexMap[format])) {
            const endIndex = findClosingIndex(code, match.startIndex, "(", ")");
            const cssString = code.slice(match.startIndex, endIndex);
            const hasAlpha = cssString.includes("/") || cssString.match(/,/g)?.length === 3;
            parsedColors.push({ selection: cssString, cssString, hasAlpha, startIndex: match.startIndex, endIndex });
          }
        }
      }

      parsedColors = removeNestedColorStrings(parsedColors);

      if (parsedColors.length === 0) return code;

      const replacements = parsedColorsToVec(parsedColors);

      for (const { before, after } of replacements) {
        code = code.replaceAll(before, after);
      }

      return code;
    },
  }
}

function parsedColorsToVec(colors: Array<ParsedColor>) {
  const canvas = document.createElement("canvas");
  canvas.width = colors.length;
  canvas.height = 1;

  const ctx = canvas.getContext("2d")!;

  for (let i = 0; i < colors.length; i++) {
    ctx.fillStyle = colors[i].cssString;
    ctx.fillRect(i, 0, 1, 1);
  }

  const { data } = ctx.getImageData(0, 0, colors.length, 1, { colorSpace: "srgb" });

  const replacements: { before: string, after: string }[] = [];

  for (let i = 0; i < colors.length; i++) {
    const { selection, hasAlpha } = colors[i];

    const components: Array<string> = [];
    for (let j = 0, n = hasAlpha ? 4 : 3; j < n; j++) {
      const component = (data[4 * i + j] / 255).toFixed(4);
      components.push(component);
    }

    const colorVector = `vec${hasAlpha ? 4 : 3}(${components.join(", ")})`;
    replacements.push({ before: selection, after: colorVector });

  }

  canvas.remove();

  return replacements;
}

function removeNestedColorStrings(colors: Array<ParsedColor>) {
  if (colors.length === 0) return [];

  colors.sort((a, b) => a.startIndex - b.startIndex);

  let currentParent = colors.shift()!;
  let newColors: Array<ParsedColor> = [currentParent];

  for (const color of colors) {
    if (color.startIndex > currentParent.startIndex && color.endIndex < currentParent.endIndex) continue;

    newColors.push(color);
    currentParent = color;
  }

  return newColors;
}