
export function splitAtCommasOutsideBraces(input: string) {
  const components: Array<string> = [];

  let nestedness = 0;

  let start = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (char === "," && nestedness === 0) {
      components.push(input.slice(start, i).trim());
      start = i + 1;
    }
    else if (char === "(" || char === "{") nestedness++;
    else if (char === ")" || char === "}") nestedness--;
  }

  if (nestedness !== 0) throw new Error(`Unbalanced bracets in ${input}`);

  if (start < input.length) components.push(input.slice(start).trim());

  return components;
}
