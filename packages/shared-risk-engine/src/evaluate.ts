import type {
  Action,
  FieldMetadata,
  KnownDomainsConfig,
  ProtectedMatchType,
  ProtectedPatternsConfig,
  RiskEngineInput,
  RiskResult,
  ScoringConfig,
  SubmitInterceptionConfig,
  SurfaceType,
} from "./types.js";

const PROTECTED_PRIORITY: ProtectedMatchType[] = [
  "email",
  "phone",
  "card_adjacent",
  "dob",
  "address",
  "full_name",
];

function normalizeHostname(host: string): string {
  return host.trim().toLowerCase().replace(/^www\./, "");
}

export function matchesKnownDomain(
  hostname: string,
  known: KnownDomainsConfig,
): boolean {
  const h = normalizeHostname(hostname);
  for (const exact of known.hostnames) {
    if (h === normalizeHostname(exact)) return true;
  }
  for (const suf of known.hostname_suffixes ?? []) {
    const s = suf.startsWith(".") ? suf.slice(1) : suf;
    if (h === s || h.endsWith(`.${s}`)) return true;
  }
  return false;
}

function foldExtendedField(field: FieldMetadata): string {
  const parts = [
    field.tagName,
    field.type,
    field.name,
    field.id,
    field.className,
    field.placeholder,
    field.autocomplete,
    field.ariaLabel,
    field.labelText,
    field.nearbyHeadingText,
    field.nearbyButtonText,
    field.formAction,
    field.formContextSnippet,
    ...(field.dataset ? Object.values(field.dataset) : []),
  ];
  return parts.filter(Boolean).join(" ").toLowerCase();
}

function scoreTermHits(
  haystack: string,
  terms: string[],
  hitWeight: number,
  cap: number,
): { score: number; triggered: string[]; reasons: string[] } {
  const lower = haystack.toLowerCase();
  const triggered: string[] = [];
  const reasons: string[] = [];
  let score = 0;
  for (const term of terms) {
    const t = term.toLowerCase();
    if (t.length === 0) continue;
    if (lower.includes(t)) {
      triggered.push(term);
      reasons.push(`page_term:${term}`);
      score += hitWeight;
      if (score >= cap) {
        score = cap;
        break;
      }
    }
  }
  return { score, triggered, reasons };
}

function scoreFieldTermHits(
  haystack: string,
  terms: string[],
  hitWeight: number,
  cap: number,
): { score: number; triggered: string[]; reasons: string[] } {
  const lower = haystack.toLowerCase();
  const triggered: string[] = [];
  const reasons: string[] = [];
  let score = 0;
  for (const term of terms) {
    const t = term.toLowerCase();
    if (t.length === 0) continue;
    if (lower.includes(t)) {
      triggered.push(term);
      reasons.push(`field_term:${term}`);
      score += hitWeight;
      if (score >= cap) {
        score = cap;
        break;
      }
    }
  }
  return { score, triggered, reasons };
}

function scoreComboRisk(
  haystackLower: string,
  scoring: ScoringConfig,
): { bonus: number; triggered: string[]; reasons: string[] } {
  const cfg = scoring.combo_risk;
  if (!cfg?.pairs?.length) {
    return { bonus: 0, triggered: [], reasons: [] };
  }
  let bonus = 0;
  const triggered: string[] = [];
  const reasons: string[] = [];
  const w = cfg.weight_per_pair;
  const cap = cfg.max_combo_bonus;
  for (const pair of cfg.pairs) {
    if (pair.length < 2) continue;
    const parts = pair.map((p) => p.toLowerCase());
    const ok = parts.every((p) => haystackLower.includes(p));
    if (ok) {
      const tag = `combo:${pair.join("|")}`;
      triggered.push(tag);
      reasons.push(`combo_match:${pair.join("+")}`);
      bonus += w;
      if (bonus >= cap) {
        bonus = cap;
      }
    }
  }
  return { bonus: Math.min(bonus, cap), triggered, reasons };
}

function scoreFieldBoosts(
  fieldLower: string,
  scoring: ScoringConfig,
): { bonus: number; reasons: string[] } {
  const terms = scoring.field_boost_terms ?? [];
  const cap = scoring.field_boost_cap ?? 36;
  let bonus = 0;
  const reasons: string[] = [];
  for (const { match, weight } of terms) {
    const m = match.toLowerCase();
    if (m.length === 0) continue;
    if (fieldLower.includes(m)) {
      bonus += weight;
      reasons.push(`field_lexicon:${match}`);
    }
  }
  return { bonus: Math.min(bonus, cap), reasons };
}

function mergeTriggered(a: string[], b: string[]): string[] {
  const set = new Set<string>();
  for (const x of [...a, ...b]) set.add(x);
  return [...set];
}

function fieldSensitiveBonus(
  fieldText: string,
  substrings: string[],
  maxBonus: number,
): { bonus: number; reasons: string[] } {
  const reasons: string[] = [];
  let hits = 0;
  for (const s of substrings) {
    if (fieldText.includes(s.toLowerCase())) {
      hits += 1;
      reasons.push(`sensitive_field_hint:${s}`);
    }
  }
  const step = Math.max(1, Math.floor(maxBonus / 3));
  return { bonus: Math.min(hits * step, maxBonus), reasons };
}

function compilePatterns(
  patterns: ProtectedPatternsConfig,
): Partial<Record<ProtectedMatchType, RegExp>> {
  const out: Partial<Record<ProtectedMatchType, RegExp>> = {};
  for (const key of PROTECTED_PRIORITY) {
    const src = patterns.patterns[key];
    if (!src) continue;
    try {
      out[key] = new RegExp(src, "i");
    } catch {
      /* skip invalid */
    }
  }
  return out;
}

export function detectProtectedMatch(
  text: string,
  patterns: ProtectedPatternsConfig,
): ProtectedMatchType {
  if (!text || text.trim().length === 0) return "none";
  const compiled = compilePatterns(patterns);
  for (const key of PROTECTED_PRIORITY) {
    const re = compiled[key];
    if (re && re.test(text)) return key;
  }
  return "none";
}

function blockInputAllowed(
  scoring: ScoringConfig,
  policy?: RiskEngineInput["policy"],
): boolean {
  const fromConfig = scoring.block_input_policy?.enabled !== false;
  const fromPolicy = policy?.block_input_enabled !== false;
  return fromConfig && fromPolicy;
}

function decideAction(
  pageScore: number,
  fieldScore: number,
  protectedType: ProtectedMatchType,
  scoring: ScoringConfig,
  allowBlockInput: boolean,
): { action: Action; hint?: string } {
  const t = scoring.thresholds;

  if (protectedType === "none") {
    if (pageScore < t.warn_only_min && fieldScore < t.warn_only_min) {
      return { action: "allow" };
    }
    return { action: "warn_only", hint: "risky_page_or_field_no_protected_payload" };
  }

  const pageHigh = pageScore >= t.high_page;
  const fieldHigh = fieldScore >= t.high_field;
  const pageVH = pageScore >= t.very_high_page;
  const fieldVH = fieldScore >= t.very_high_field;
  const redact =
    protectedType === "card_adjacent" ||
    pageScore >= t.redact_page ||
    fieldScore >= t.redact_field;

  if (pageVH || fieldVH) {
    if (redact) {
      return {
        action: "redact_and_block",
        hint: "very_high_risk_with_sensitive_or_card_context",
      };
    }
    if (allowBlockInput) {
      return { action: "block_input", hint: "very_high_risk_context" };
    }
    return { action: "block_paste", hint: "very_high_risk_block_input_disabled" };
  }

  if (pageHigh || fieldHigh) {
    return { action: "block_paste", hint: "high_risk_page_or_field_with_protected_data" };
  }

  if (pageScore >= t.warn_only_min || fieldScore >= t.warn_only_min) {
    return { action: "warn_only", hint: "elevated_risk_but_below_block_thresholds" };
  }

  return { action: "allow", hint: "protected_payload_on_benign_context" };
}

/** Surface classification terms with their associated surface types */
const SURFACE_TERMS: Record<string, SurfaceType> = {
  // KYC surface
  "verify identity": "kyc_surface",
  "kyc": "kyc_surface",
  "identity verification": "kyc_surface",
  "id verification": "kyc_surface",
  "document verification": "kyc_surface",

  // Cashier surface
  "cashier": "cashier_surface",
  "wallet": "cashier_surface",
  "deposit": "cashier_surface",
  "withdraw": "cashier_surface",
  "withdrawal": "cashier_surface",
  "redeem": "cashier_surface",
  "redemption": "cashier_surface",
  "billing": "cashier_surface",
  "card": "cashier_surface",
  "cvv": "cashier_surface",
  "cvc": "cashier_surface",
  "payment method": "cashier_surface",

  // Signup surface
  "register": "signup_surface",
  "sign up": "signup_surface",
  "signup": "signup_surface",
  "create account": "signup_surface",
  "join now": "signup_surface",
  "get started": "signup_surface",
  "new account": "signup_surface",

  // Login surface
  "login": "login_surface",
  "log in": "login_surface",
  "sign in": "login_surface",
  "signin": "login_surface",
  "account access": "login_surface",
  "existing user": "login_surface",
};

/** Surface type priority for tie-breaking (higher = more sensitive) */
const SURFACE_PRIORITY: Record<SurfaceType, number> = {
  "kyc_surface": 5,
  "cashier_surface": 4,
  "signup_surface": 3,
  "login_surface": 2,
  "benign_form": 1,
  "unknown_surface": 0,
};

/**
 * Classify the page/form surface based on URL, title, form text, field metadata, and nearby elements.
 * Returns the most sensitive surface type found.
 */
export function classifySurface(
  pageUrl: string,
  pageTitle: string,
  field: FieldMetadata,
  formBlockText?: string,
): SurfaceType {
  const haystackParts: string[] = [];

  // URL/path
  try {
    const url = new URL(pageUrl);
    haystackParts.push(url.pathname, url.search);
  } catch {
    haystackParts.push(pageUrl);
  }

  // Page title
  haystackParts.push(pageTitle);

  // Form context
  if (formBlockText) {
    haystackParts.push(formBlockText);
  }
  if (field.formContextSnippet) {
    haystackParts.push(field.formContextSnippet);
  }

  // Field metadata
  haystackParts.push(
    field.name ?? "",
    field.id ?? "",
    field.placeholder ?? "",
    field.className ?? "",
    field.labelText ?? "",
    field.nearbyHeadingText ?? "",
    field.nearbyButtonText ?? "",
    field.formAction ?? "",
    field.autocomplete ?? "",
  );

  const haystack = haystackParts.join(" ").toLowerCase();

  // Score each surface type
  const scores: Record<SurfaceType, number> = {
    "benign_form": 0,
    "signup_surface": 0,
    "login_surface": 0,
    "cashier_surface": 0,
    "kyc_surface": 0,
    "unknown_surface": 0,
  };

  for (const [term, surface] of Object.entries(SURFACE_TERMS)) {
    const count = (haystack.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
    scores[surface] += count;
  }

  // Login-specific signals (stronger weight)
  const hasPasswordField =
    field.type === "password" ||
    /password|pass|pwd/.test(`${field.name ?? ""} ${field.id ?? ""} ${field.placeholder ?? ""}`.toLowerCase());
  const hasEmailField =
    field.type === "email" ||
    /email|e-mail|username|user/.test(`${field.name ?? ""} ${field.id ?? ""} ${field.placeholder ?? ""}`.toLowerCase());

  if (hasPasswordField && hasEmailField) {
    scores["login_surface"] += 2;
  }
  if (hasPasswordField && !scores["signup_surface"]) {
    scores["login_surface"] += 1;
  }

  // Signup-specific signals
  const hasConfirmPassword = /confirm.*password|password.*confirm|retype|repeat.*password/.test(haystack);
  if (hasConfirmPassword) {
    scores["signup_surface"] += 2;
  }

  // KYC-specific signals
  const hasKycFields =
    /dob|birth|date of birth|ssn|social security|document|id card|passport|driver.*license|address|phone/.test(haystack);
  if (hasKycFields) {
    scores["kyc_surface"] += 1;
  }

  // Cashier-specific signals
  const hasCardFields =
    /card.*number|cardnum|ccnum|expir|exp.*date|cvv|cvc|billing/.test(haystack);
  if (hasCardFields) {
    scores["cashier_surface"] += 2;
  }

  try {
    const url = new URL(pageUrl);
    const p = url.pathname.toLowerCase();
    if (p.includes("login") || p.includes("signin") || p.includes("sign-in")) {
      scores["login_surface"] += 8;
    }
    if (p.includes("register") || p.includes("signup") || p.includes("sign-up")) {
      scores["signup_surface"] += 8;
    }
    if (p.includes("cashier") || p.includes("wallet") || p.includes("deposit")) {
      scores["cashier_surface"] += 5;
    }
  } catch {
    /* ignore bad URLs */
  }

  // Find the highest scoring surface type
  let bestSurface: SurfaceType = "unknown_surface";
  let bestScore = 0;

  for (const [surface, score] of Object.entries(scores) as [SurfaceType, number][]) {
    if (score > bestScore) {
      bestScore = score;
      bestSurface = surface;
    } else if (score === bestScore && score > 0) {
      // Tie-break by priority
      if (SURFACE_PRIORITY[surface] > SURFACE_PRIORITY[bestSurface]) {
        bestSurface = surface;
      }
    }
  }

  // If no clear signals and we have a simple form, mark as benign
  if (bestScore === 0) {
    const isSimpleForm = /search|query|subscribe|contact|feedback/.test(haystack);
    return isSimpleForm ? "benign_form" : "unknown_surface";
  }

  return bestSurface;
}

/** Surfaces where submit interception is considered (not benign/unknown). */
export const SUBMIT_INTERCEPT_SURFACES: SurfaceType[] = [
  "signup_surface",
  "login_surface",
  "cashier_surface",
  "kyc_surface",
];

const DEFAULT_SUBMIT: SubmitInterceptionConfig = {
  enabled: true,
  warn_min_score: 20,
  warn_min_page: 15,
  warn_min_field: 15,
  block_submit_min_score: 45,
  min_page_for_block: 30,
  min_field_for_block: 30,
};

/**
 * Submit-time evaluation: returns only `allow`, `warn_only`, or `block_submit` (overrides paste-oriented actions).
 * Conservative: never returns block_submit on benign_form / unknown_surface at low risk.
 */
export function evaluateSubmitRisk(input: RiskEngineInput): RiskResult {
  const base = evaluateRisk(input);
  const cfg = { ...DEFAULT_SUBMIT, ...input.scoring.submit_interception };
  if (!cfg.enabled) {
    return {
      ...base,
      action: "allow",
      safe_paste_trigger_hint: "submit_interception_disabled",
    };
  }

  if (!SUBMIT_INTERCEPT_SURFACES.includes(base.surface_type)) {
    return {
      ...base,
      action: "allow",
      safe_paste_trigger_hint: "submit_non_target_surface",
    };
  }

  const maxScore = Math.max(base.page_risk_score, base.field_risk_score);
  const hasPii = base.protected_match_type !== "none";

  const warnElevated =
    maxScore >= cfg.warn_min_score ||
    base.page_risk_score >= cfg.warn_min_page ||
    base.field_risk_score >= cfg.warn_min_field;

  const blockThreshold =
    hasPii &&
    maxScore >= cfg.block_submit_min_score &&
    base.page_risk_score >= cfg.min_page_for_block &&
    base.field_risk_score >= cfg.min_field_for_block;

  if (blockThreshold) {
    return {
      ...base,
      action: "block_submit",
      safe_paste_trigger_hint: "submit_blocked_high_risk_pii",
    };
  }

  if (warnElevated) {
    return {
      ...base,
      action: "warn_only",
      safe_paste_trigger_hint: "submit_warn_confirm",
    };
  }

  return {
    ...base,
    action: "allow",
    safe_paste_trigger_hint: "submit_allowed_low_risk",
  };
}

export function evaluateRisk(input: RiskEngineInput): RiskResult {
  const { scoring, riskTerms, knownDomains } = input;
  const w = scoring.weights;
  const allowBlockInput = blockInputAllowed(scoring, input.policy);

  const page_risk_reasons: string[] = [];
  const field_risk_reasons: string[] = [];

  const formBlock = input.pageContext?.formBlockText ?? "";
  const pageHaystack = `${input.pageTitle}\n${input.visibleTextSample}\n${formBlock}`;
  const pageHayLower = pageHaystack.toLowerCase();

  // Classify the surface type
  const surface_type = classifySurface(input.pageUrl, input.pageTitle, input.field, formBlock);

  const pageHits = scoreTermHits(
    pageHaystack,
    riskTerms.terms,
    w.page_term_hit,
    w.page_term_cap,
  );
  page_risk_reasons.push(...pageHits.reasons);

  const combo = scoreComboRisk(pageHayLower, scoring);
  page_risk_reasons.push(...combo.reasons);

  const fieldHaystack = foldExtendedField(input.field);
  const fieldHits = scoreFieldTermHits(
    fieldHaystack,
    riskTerms.terms,
    w.field_term_hit,
    w.field_term_cap,
  );
  field_risk_reasons.push(...fieldHits.reasons);

  const fieldBoost = scoreFieldBoosts(fieldHaystack, scoring);
  field_risk_reasons.push(...fieldBoost.reasons);

  let pageScore = pageHits.score + combo.bonus;
  let fieldScore = fieldHits.score + fieldBoost.bonus;

  if (matchesKnownDomain(input.hostname, knownDomains)) {
    pageScore += w.domain_match;
    page_risk_reasons.push("known_high_risk_domain");
  }

  const sens = fieldSensitiveBonus(
    fieldHaystack,
    scoring.sensitive_field_substrings,
    w.field_sensitive_bonus,
  );
  fieldScore += sens.bonus;
  field_risk_reasons.push(...sens.reasons);

  pageScore = Math.min(100, Math.round(pageScore));
  fieldScore = Math.min(100, Math.round(fieldScore));

  const triggered = mergeTriggered(
    mergeTriggered(pageHits.triggered, fieldHits.triggered),
    combo.triggered,
  );

  const protectedType = detectProtectedMatch(
    input.protectedTextCandidate,
    input.protectedPatterns,
  );

  const decision = decideAction(
    pageScore,
    fieldScore,
    protectedType,
    scoring,
    allowBlockInput,
  );

  const legacyReasons = [...page_risk_reasons, ...field_risk_reasons];

  return {
    page_risk_score: pageScore,
    field_risk_score: fieldScore,
    protected_match_type: protectedType,
    action: decision.action,
    triggered_terms: triggered,
    risk_reasons: legacyReasons,
    page_risk_reasons,
    field_risk_reasons,
    safe_paste_trigger_hint: decision.hint,
    rule_version: scoring.rule_version,
    surface_type,
  };
}
