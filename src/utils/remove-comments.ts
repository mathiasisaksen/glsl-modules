import { blockCommentRegex, lineCommentRegex } from "./regexes.js";

export function removeComments(string: string) {
  return string.replaceAll(lineCommentRegex, "").replaceAll(blockCommentRegex, "");
}