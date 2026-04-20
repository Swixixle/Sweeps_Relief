import type { Action, FieldMetadata, ProtectedMatchType, SurfaceType } from "@sweeps-relief/shared-risk-engine";

export interface DefenseReceipt {
  timestamp: string;
  page_url: string;
  hostname: string;
  title: string;
  action: Action;
  page_risk_score: number;
  field_risk_score: number;
  protected_match_type: ProtectedMatchType;
  triggered_terms: string[];
  field_context: FieldMetadata;
  rule_version: string;
  source: "chromium" | "safari" | "test";
  /** Optional explainability fields */
  page_risk_reasons?: string[];
  field_risk_reasons?: string[];
  /** Short JSON or text for local debugging */
  debug_summary?: string;
  /** Surface type classification */
  surface_type?: SurfaceType;
  /** Whether submit was intercepted */
  submit_intercepted?: boolean;
}
