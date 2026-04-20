import {
  submitShouldBlock,
  submitShouldWarn,
  typingShouldBeBlocked,
} from "@sweeps-relief/browser-guard-core";
import { debugEvaluationShape } from "@sweeps-relief/shared-risk-engine";
import { bundledRules } from "./bundledRules.js";
import {
  buildPasteContextFromDom,
  evaluatePasteForContext,
  evaluateSubmitForContext,
  makeReceiptFromPaste,
  shouldPreventPaste,
} from "./pasteFlow.js";

const GUARD_KEY = "guardEnabled";
const DEBUG_KEY = "debugMode";
const BLOCK_INPUT_KEY = "blockInputEnabled";
const OVERLAY_ID = "sweeps-relief-debug-overlay";

/** Sync cache — submit must call preventDefault in the same turn. */
let prefsCache = {
  guard: true,
  debug: false,
  blockInput: true,
};

async function refreshPrefsCache(): Promise<void> {
  const v = await chrome.storage.sync.get([GUARD_KEY, DEBUG_KEY, BLOCK_INPUT_KEY]);
  prefsCache = {
    guard: v[GUARD_KEY] !== false,
    debug: v[DEBUG_KEY] === true,
    blockInput: v[BLOCK_INPUT_KEY] !== false,
  };
}

void refreshPrefsCache();
chrome.storage.onChanged.addListener(() => {
  void refreshPrefsCache();
});

function persistDebugAsync(result: ReturnType<typeof evaluatePasteForContext>): void {
  void chrome.storage.local.set({
    lastDebugEval: debugEvaluationShape(result),
    lastDebugAt: Date.now(),
  });
}

function recordReceipt(receipt: ReturnType<typeof makeReceiptFromPaste>): void {
  void chrome.runtime.sendMessage({ type: "sweeps:receipt", receipt });
}

function logDebugConsole(
  result: ReturnType<typeof evaluatePasteForContext>,
  extra: { submit?: boolean } = {},
): void {
  // eslint-disable-next-line no-console
  console.group("[Sweeps Guard]");
  // eslint-disable-next-line no-console
  console.log(debugEvaluationShape(result));
  if (extra.submit) {
    // eslint-disable-next-line no-console
    console.log("submit_evaluation: true");
  }
  // eslint-disable-next-line no-console
  console.groupEnd();
}

function upsertDebugOverlay(
  result: ReturnType<typeof evaluatePasteForContext>,
  enabled: boolean,
): void {
  if (!enabled) {
    document.getElementById(OVERLAY_ID)?.remove();
    return;
  }
  let box = document.getElementById(OVERLAY_ID) as HTMLPreElement | null;
  if (!box) {
    box = document.createElement("pre");
    box.id = OVERLAY_ID;
    box.setAttribute("aria-hidden", "true");
    box.style.cssText =
      "position:fixed;bottom:8px;right:8px;max-width:380px;max-height:45vh;overflow:auto;margin:0;padding:8px;font:11px/1.35 ui-monospace,monospace;background:rgba(18,18,28,.94);color:#eaeaf2;border:1px solid #3a3a50;border-radius:6px;z-index:2147483646;box-shadow:0 4px 14px rgba(0,0,0,.4);pointer-events:none;white-space:pre-wrap";
    document.body.appendChild(box);
  }
  box.textContent = JSON.stringify(
    {
      surface_type: result.surface_type,
      action: result.action,
      page_risk_score: result.page_risk_score,
      field_risk_score: result.field_risk_score,
      triggered_terms: result.triggered_terms.slice(0, 28),
      page_risk_reasons: result.page_risk_reasons.slice(0, 22),
      field_risk_reasons: result.field_risk_reasons.slice(0, 22),
    },
    null,
    2,
  );
}

function gatherFormAggregate(form: HTMLFormElement): string {
  const parts: string[] = [];
  form.querySelectorAll("input, textarea, select").forEach((el) => {
    if (el instanceof HTMLInputElement) {
      if (el.type === "hidden" || el.type === "submit" || el.type === "button")
        return;
      parts.push(el.value);
    } else if (el instanceof HTMLTextAreaElement) {
      parts.push(el.value);
    } else if (el instanceof HTMLSelectElement) {
      parts.push(el.value);
    }
  });
  return parts.filter(Boolean).join("\n");
}

function primaryFieldInForm(form: HTMLFormElement): Element | null {
  return (
    form.querySelector(
      'input[type="email"],input[name*="email" i],input[name*="login" i],input[type="password"],input[type="text"]',
    ) ?? form.querySelector("input, textarea")
  );
}

function evaluatePasteField(target: Element | null, text: string, blockInput: boolean) {
  const ctx = buildPasteContextFromDom(bundledRules, target, text, {
    policy: { block_input_enabled: blockInput },
  });
  const result = evaluatePasteForContext(ctx);
  return { ctx, result };
}

function evaluateSubmitField(form: HTMLFormElement, blockInput: boolean) {
  const aggregate = gatherFormAggregate(form);
  const target = primaryFieldInForm(form);
  const ctx = buildPasteContextFromDom(bundledRules, target, aggregate || " ", {
    policy: { block_input_enabled: blockInput },
  });
  const result = evaluateSubmitForContext(ctx);
  return { ctx, result };
}

function applySubmitGuards(
  ev: Event,
  form: HTMLFormElement,
): void {
  if (!prefsCache.guard) return;
  const { ctx, result } = evaluateSubmitField(form, prefsCache.blockInput);

  if (prefsCache.debug) {
    persistDebugAsync(result);
    logDebugConsole(result, { submit: true });
    upsertDebugOverlay(result, true);
  }

  if (submitShouldBlock(result)) {
    ev.preventDefault();
    ev.stopPropagation();
    recordReceipt(
      makeReceiptFromPaste(ctx, result, {
        includeDebugSummary: prefsCache.debug,
        submitIntercepted: true,
      }),
    );
    void chrome.runtime.sendMessage({ type: "sweeps:blocked" });
    return;
  }

  if (submitShouldWarn(result)) {
    const ok = confirm(
      "Sweeps Guard: this form looks risky. Submit anyway?",
    );
    if (!ok) {
      ev.preventDefault();
      ev.stopPropagation();
      recordReceipt(
        makeReceiptFromPaste(ctx, result, {
          includeDebugSummary: prefsCache.debug,
          submitIntercepted: true,
        }),
      );
      void chrome.runtime.sendMessage({ type: "sweeps:blocked" });
    }
  }
}

const formsAttached = new WeakSet<HTMLFormElement>();

function attachForm(form: HTMLFormElement): void {
  if (formsAttached.has(form)) return;
  formsAttached.add(form);
  form.addEventListener("submit", (ev) => applySubmitGuards(ev, form), true);
}

function scanForms(): void {
  if (!prefsCache.guard) return;
  document.querySelectorAll("form").forEach((f) => {
    attachForm(f as HTMLFormElement);
  });
}

document.addEventListener(
  "paste",
  (ev: ClipboardEvent) => {
    if (!prefsCache.guard) return;
    const text = ev.clipboardData?.getData("text/plain") ?? "";
    if (!text.trim()) return;
    const target = (ev.target as Node | null)?.nodeType === Node.ELEMENT_NODE
      ? (ev.target as Element)
      : (ev.target as Node | null)?.parentElement ?? null;
    const { ctx, result } = evaluatePasteField(
      target,
      text,
      prefsCache.blockInput,
    );

    if (prefsCache.debug) {
      persistDebugAsync(result);
      logDebugConsole(result);
      upsertDebugOverlay(result, true);
    } else {
      upsertDebugOverlay(result, false);
    }

    if (result.action === "warn_only") {
      void chrome.runtime.sendMessage({
        type: "sweeps:warn",
        detail: { hostname: ctx.hostname, action: result.action },
      });
    }
    if (shouldPreventPaste(result)) {
      ev.preventDefault();
      ev.stopPropagation();
      recordReceipt(
        makeReceiptFromPaste(ctx, result, {
          includeDebugSummary: prefsCache.debug,
        }),
      );
      void chrome.runtime.sendMessage({ type: "sweeps:blocked" });
    }
  },
  true,
);

document.addEventListener(
  "beforeinput",
  (ev: Event) => {
    if (!prefsCache.guard || !prefsCache.blockInput) return;
    const e = ev as InputEvent;
    if (e.inputType === "insertFromPaste") return;
    const raw = e.target;
    if (!raw || raw.nodeType !== Node.ELEMENT_NODE) return;
    const el = raw as HTMLElement;
    if (
      el.tagName !== "INPUT" &&
      el.tagName !== "TEXTAREA" &&
      !el.isContentEditable
    ) {
      return;
    }
    let next = "";
    if ("value" in el && typeof (el as HTMLInputElement).value === "string") {
      const v = el as HTMLInputElement;
      const start = v.selectionStart ?? v.value.length;
      const end = v.selectionEnd ?? v.value.length;
      const ins = e.data ?? "";
      next = v.value.slice(0, start) + ins + v.value.slice(end);
    } else {
      next = `${(el as HTMLElement).innerText}${e.data ?? ""}`;
    }
    if (!next.trim()) return;
    const { ctx, result } = evaluatePasteField(el, next, prefsCache.blockInput);
    if (prefsCache.debug) {
      persistDebugAsync(result);
      logDebugConsole(result);
      upsertDebugOverlay(result, true);
    }
    if (typingShouldBeBlocked(result)) {
      e.preventDefault();
      recordReceipt(
        makeReceiptFromPaste(ctx, result, {
          includeDebugSummary: prefsCache.debug,
        }),
      );
      void chrome.runtime.sendMessage({ type: "sweeps:blocked" });
    }
  },
  true,
);

void refreshPrefsCache().then(() => {
  scanForms();
});
const mo = new MutationObserver(() => {
  scanForms();
});
if (document.documentElement) {
  mo.observe(document.documentElement, { childList: true, subtree: true });
}
