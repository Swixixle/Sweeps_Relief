import {
  evaluatePasteDefense,
  evaluateSubmitDefense,
  enrichFieldMetadata,
  gatherPageContextFromField,
  pasteShouldBeBlocked,
  sampleVisibleText,
  type RulesBundle,
} from "@sweeps-relief/browser-guard-core";
import { buildReceipt } from "@sweeps-relief/shared-receipts";
import type { DefenseReceipt } from "@sweeps-relief/shared-receipts";
import type {
  FieldMetadata,
  PageContextAugment,
  RiskPolicyOverrides,
  RiskResult,
} from "@sweeps-relief/shared-risk-engine";

export interface PasteEvaluationContext {
  rules: RulesBundle;
  pageUrl: string;
  hostname: string;
  pageTitle: string;
  visibleTextSample: string;
  field: FieldMetadata;
  clipboardText: string;
  pageContext?: PageContextAugment;
  policy?: RiskPolicyOverrides;
}

/** Pure path used by the content script and unit tests (no DOM). */
export function evaluatePasteForContext(ctx: PasteEvaluationContext) {
  return evaluatePasteDefense({
    pageUrl: ctx.pageUrl,
    hostname: ctx.hostname,
    pageTitle: ctx.pageTitle,
    visibleTextSample: ctx.visibleTextSample,
    field: ctx.field,
    clipboardText: ctx.clipboardText,
    rules: ctx.rules,
    pageContext: ctx.pageContext,
    policy: ctx.policy,
  });
}

/** Submit-time: aggregate field values as `clipboardText` (PII detection). */
export function evaluateSubmitForContext(ctx: PasteEvaluationContext) {
  return evaluateSubmitDefense({
    pageUrl: ctx.pageUrl,
    hostname: ctx.hostname,
    pageTitle: ctx.pageTitle,
    visibleTextSample: ctx.visibleTextSample,
    field: ctx.field,
    clipboardText: ctx.clipboardText,
    rules: ctx.rules,
    pageContext: ctx.pageContext,
    policy: ctx.policy,
  });
}

export function makeReceiptFromPaste(
  ctx: PasteEvaluationContext,
  result: RiskResult,
  opts?: { includeDebugSummary?: boolean; submitIntercepted?: boolean },
): DefenseReceipt {
  return buildReceipt({
    pageUrl: ctx.pageUrl,
    hostname: ctx.hostname,
    title: ctx.pageTitle,
    field: ctx.field,
    result,
    source: "chromium",
    includeDebugSummary: opts?.includeDebugSummary,
    submitIntercepted: opts?.submitIntercepted,
  });
}

export function shouldPreventPaste(result: RiskResult): boolean {
  return pasteShouldBeBlocked(result);
}

export function buildPasteContextFromDom(
  rules: RulesBundle,
  target: Element | null,
  clipboardText: string,
  opts?: { policy?: RiskPolicyOverrides },
): PasteEvaluationContext {
  const field = enrichFieldMetadata(target);
  const pageContext = gatherPageContextFromField(target);
  const visibleTextSample = sampleVisibleText(document.body);
  const pageUrl = window.location.href;
  const hostname = window.location.hostname;
  const pageTitle = document.title;
  return {
    rules,
    pageUrl,
    hostname,
    pageTitle,
    visibleTextSample,
    field,
    clipboardText,
    pageContext,
    policy: opts?.policy,
  };
}
