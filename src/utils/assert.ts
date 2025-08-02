
export function assert(test: any, errorMessage: string) {
  if (!test) throw new Error("Assertion failed:\n" + errorMessage);
}