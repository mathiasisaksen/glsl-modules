
export function blankOutSubstring(string: string, start: number, end: number) {
  const blankReplacement = Array(end - start).fill(" ").join("");
  return string.slice(0, start) + blankReplacement + string.slice(end);
}
