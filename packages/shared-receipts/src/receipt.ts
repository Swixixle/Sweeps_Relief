import type { RiskResult } from "@sweeps-relief/shared-risk-engine";
import { debugEvaluationShape } from "@sweeps-relief/shared-risk-engine";
import type { DefenseReceipt } from "./types.js";

export function buildReceipt(params: {
  pageUrl: string;
  hostname: string;
  title: string;
  field: DefenseReceipt["field_context"];
  result: RiskResult;
  source: DefenseReceipt["source"];
  includeDebugSummary?: boolean;
  submitIntercepted?: boolean;
}): DefenseReceipt {
  const r: DefenseReceipt = {
    timestamp: new Date().toISOString(),
    page_url: params.pageUrl,
    hostname: params.hostname,
    title: params.title,
    action: params.result.action,
    page_risk_score: params.result.page_risk_score,
    field_risk_score: params.result.field_risk_score,
    protected_match_type: params.result.protected_match_type,
    triggered_terms: params.result.triggered_terms,
    field_context: params.field,
    rule_version: params.result.rule_version,
    source: params.source,
    page_risk_reasons: params.result.page_risk_reasons,
    field_risk_reasons: params.result.field_risk_reasons,
    surface_type: params.result.surface_type,
  };
  if (params.includeDebugSummary) {
    r.debug_summary = JSON.stringify(debugEvaluationShape(params.result));
  }
  if (params.submitIntercepted) {
    r.submit_intercepted = true;
  }
  return r;
}

export function receiptToJsonLine(receipt: DefenseReceipt): string {
  return `${JSON.stringify(receipt)}\n`;
}
