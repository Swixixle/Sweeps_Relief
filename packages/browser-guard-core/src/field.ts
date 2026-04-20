import type { FieldMetadata } from "@sweeps-relief/shared-risk-engine";

export function fieldMetadataFromElement(el: Element | null): FieldMetadata {
  if (!el) return {};
  const tag = el.tagName?.toLowerCase() ?? "";
  if (tag === "input" || tag === "textarea") {
    const input = el as HTMLInputElement | HTMLTextAreaElement;
    return {
      tagName: tag,
      type: "type" in input ? input.type : undefined,
      name: input.name,
      id: input.id,
      placeholder: input.placeholder,
      autocomplete: input.autocomplete,
      ariaLabel: input.getAttribute("aria-label") ?? undefined,
    };
  }
  if (tag === "div" || tag === "span") {
    const he = el as HTMLElement;
    if (he.isContentEditable === true || he.contentEditable === "true") {
      return {
        tagName: tag,
        id: he.id,
        ariaLabel: he.getAttribute("aria-label") ?? undefined,
        dataset: { ...he.dataset } as Record<string, string>,
      };
    }
  }
  return { tagName: tag };
}
