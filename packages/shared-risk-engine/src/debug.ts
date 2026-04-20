import type { RiskResult } from "./types.js";

/** Stable shape for options-page / manual debugging (no DOM). */
export function debugEvaluationShape(result: RiskResult): Record<string, unknown> {
  return {
    page_risk_score: result.page_risk_score,
    field_risk_score: result.field_risk_score,
    triggered_terms: result.triggered_terms,
    page_risk_reasons: result.page_risk_reasons,
    field_risk_reasons: result.field_risk_reasons,
    protected_match_type: result.protected_match_type,
    action: result.action,
    safe_paste_trigger_hint: result.safe_paste_trigger_hint,
    rule_version: result.rule_version,
    surface_type: result.surface_type,
  };
}
