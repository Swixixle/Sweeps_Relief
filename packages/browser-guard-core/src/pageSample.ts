const DEFAULT_MAX = 8000;

export function sampleVisibleText(root: ParentNode = document.body, max = DEFAULT_MAX): string {
  if (!root || !("innerText" in root)) return "";
  const body = root as HTMLElement;
  const t = body.innerText ?? "";
  if (t.length <= max) return t;
  return `${t.slice(0, max)}\n…`;
}
