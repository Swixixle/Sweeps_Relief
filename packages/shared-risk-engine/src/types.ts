export type Action =
  | "allow"
  | "warn_only"
  | "block_paste"
  | "block_input"
  | "block_submit"
  | "redact_and_block";

export type SurfaceType =
  | "benign_form"
  | "signup_surface"
  | "login_surface"
  | "cashier_surface"
  | "kyc_surface"
  | "unknown_surface";

export type ProtectedMatchType =
  | "none"
  | "email"
  | "phone"
  | "full_name"
  | "address"
  | "dob"
  | "card_adjacent";

export interface FieldMetadata {
  tagName?: string;
  type?: string;
  name?: string;
  id?: string;
  /** Space or class string from DOM */
  className?: string;
  placeholder?: string;
  autocomplete?: string;
  ariaLabel?: string;
  /** Associated label text (for= or wrapping label). */
  labelText?: string;
  /** Nearby h1–h3 in section/form */
  nearbyHeadingText?: string;
  /** Submit / button copy in the same form */
  nearbyButtonText?: string;
  /** Form action URL or path */
  formAction?: string;
  /** Bounded snippet of nearest form inner text (page+field context) */
  formContextSnippet?: string;
  dataset?: Record<string, string>;
}

export interface PageContextAugment {
  /** Nearest form inner text + structural context (bounded) */
  formBlockText?: string;
}

export interface KnownDomainsConfig {
  version?: string;
  hostnames: string[];
  hostname_suffixes?: string[];
}

export interface RiskTermsConfig {
  version?: string;
  terms: string[];
}

export interface ProtectedPatternsConfig {
  version?: string;
  patterns: Partial<Record<ProtectedMatchType, string>>;
}

export interface ComboRiskConfig {
  pairs: string[][];
  weight_per_pair: number;
  max_combo_bonus: number;
}

export interface FieldBoostTerm {
  match: string;
  weight: number;
}

export interface BlockInputPolicyConfig {
  enabled: boolean;
}

/** Conservative submit interception (forms on risky surfaces only). */
export interface SubmitInterceptionConfig {
  enabled: boolean;
  /** Minimum of page/field max score to show submit warning */
  warn_min_score: number;
  warn_min_page: number;
  warn_min_field: number;
  /** Block submit without confirm when PII present and scores exceed floors */
  block_submit_min_score: number;
  min_page_for_block: number;
  min_field_for_block: number;
}

export interface ScoringConfig {
  rule_version: string;
  thresholds: {
    warn_only_min: number;
    high_page: number;
    high_field: number;
    very_high_page: number;
    very_high_field: number;
    redact_page: number;
    redact_field: number;
  };
  weights: {
    domain_match: number;
    page_term_hit: number;
    page_term_cap: number;
    field_term_hit: number;
    field_term_cap: number;
    field_sensitive_bonus: number;
  };
  sensitive_field_substrings: string[];
  combo_risk?: ComboRiskConfig;
  field_boost_terms?: FieldBoostTerm[];
  field_boost_cap?: number;
  block_input_policy?: BlockInputPolicyConfig;
  submit_interception?: SubmitInterceptionConfig;
}

/** Runtime overrides (e.g. extension options). */
export interface RiskPolicyOverrides {
  /** When false, `block_input` is downgraded to `block_paste` if applicable. */
  block_input_enabled?: boolean;
}

export interface RiskEngineInput {
  pageUrl: string;
  hostname: string;
  pageTitle: string;
  visibleTextSample: string;
  field: FieldMetadata;
  protectedTextCandidate: string;
  knownDomains: KnownDomainsConfig;
  riskTerms: RiskTermsConfig;
  protectedPatterns: ProtectedPatternsConfig;
  scoring: ScoringConfig;
  /** Extra text for page-risk (form blocks, headings). */
  pageContext?: PageContextAugment;
  policy?: RiskPolicyOverrides;
}

export interface RiskResult {
  page_risk_score: number;
  field_risk_score: number;
  protected_match_type: ProtectedMatchType;
  action: Action;
  triggered_terms: string[];
  /** @deprecated prefer page_risk_reasons + field_risk_reasons */
  risk_reasons: string[];
  page_risk_reasons: string[];
  field_risk_reasons: string[];
  safe_paste_trigger_hint?: string;
  rule_version: string;
  surface_type: SurfaceType;
}
