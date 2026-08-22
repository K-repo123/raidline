/** Title-screen keys that must start a match. */
export function isTitleStartKey(code: string, key = ""): boolean {
  return code === "Enter" || code === "NumpadEnter" || key === "Enter";
}
