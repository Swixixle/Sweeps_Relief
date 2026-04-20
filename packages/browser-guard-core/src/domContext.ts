import type { FieldMetadata, PageContextAugment } from "@sweeps-relief/shared-risk-engine";
import { fieldMetadataFromElement } from "./field.js";

const MAX_FORM_SNIPPET = 4000;

function compactText(el: Element | null | undefined): string {
  if (!el) return "";
  const t = (el as HTMLElement).innerText ?? "";
  return t.replace(/\s+/g, " ").trim();
}

function labelTextFor(el: HTMLElement): string {
  if ("labels" in el && (el as HTMLInputElement).labels && (el as HTMLInputElement).labels!.length > 0) {
    const raw = (el as HTMLInputElement).labels![0].innerText ?? "";
    return raw.replace(/\s+/g, " ").trim();
  }
  if (el.id) {
    try {
      const lab = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lab) return compactText(lab);
    } catch {
      const lab = document.querySelector(`label[for="${el.id}"]`);
      if (lab) return compactText(lab);
    }
  }
  const wrap = el.closest("label");
  if (wrap) return compactText(wrap);
  return "";
}

function nearbyHeadingText(el: Element | null): string {
  const scope =
    el?.closest?.("section, article, [role='dialog'], main") ??
    el?.closest?.("form") ??
    el?.parentElement;
  if (!scope) return "";
  const hs = scope.querySelectorAll("h1, h2, h3");
  const parts: string[] = [];
  hs.forEach((h) => parts.push(h.textContent ?? ""));
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function buttonTextInForm(form: HTMLFormElement | null): string {
  if (!form) return "";
  const parts: string[] = [];
  form
    .querySelectorAll("button, [type='submit'], input[type='submit'], input[type='button']")
    .forEach((b) => {
      const node = b as HTMLInputElement;
      const t = (b as HTMLElement).innerText || node.value || "";
      if (t.trim()) parts.push(t.trim());
    });
  return parts.join(" ");
}

/** Rich field metadata for risk scoring (labels, form, headings, buttons). */
export function enrichFieldMetadata(el: Element | null): FieldMetadata {
  const base = fieldMetadataFromElement(el);
  if (!el) return base;

  let labelText = base.labelText;
  let className: string | undefined;
  let nearbyHeadingTextVal: string | undefined;
  let nearbyButtonTextVal: string | undefined;
  let formAction: string | undefined;
  let formContextSnippet: string | undefined;

  if (el instanceof HTMLElement) {
    className = typeof el.className === "string" ? el.className : String(el.className ?? "");
    labelText = labelText || labelTextFor(el);
    nearbyHeadingTextVal = nearbyHeadingText(el);
    const form = el.closest("form");
    if (form) {
      formAction = form.getAttribute("action") ?? "";
      nearbyButtonTextVal = buttonTextInForm(form);
      formContextSnippet = compactText(form).slice(0, MAX_FORM_SNIPPET);
    }
  }

  return {
    ...base,
    className: className || base.className,
    labelText: labelText || undefined,
    nearbyHeadingText: nearbyHeadingTextVal || undefined,
    nearbyButtonText: nearbyButtonTextVal || undefined,
    formAction: formAction || undefined,
    formContextSnippet: formContextSnippet || undefined,
  };
}

/** Extra page-risk text: nearest form block (bounded). */
export function gatherPageContextFromField(el: Element | null): PageContextAugment {
  const form = el?.closest?.("form");
  const formBlockText = form ? compactText(form).slice(0, MAX_FORM_SNIPPET) : "";
  return { formBlockText: formBlockText || undefined };
}
