
export function replaceByIndex(string: string, start: number, end: number, replacement: string) {
  return string.slice(0, start) + replacement + string.slice(end);
}