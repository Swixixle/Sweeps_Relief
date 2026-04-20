import {
  evaluateRisk,
  evaluateSubmitRisk,
  type FieldMetadata,
  type KnownDomainsConfig,
  type PageContextAugment,
  type ProtectedPatternsConfig,
  type RiskPolicyOverrides,
  type RiskResult,
  type RiskTermsConfig,
  type ScoringConfig,
} from "@sweeps-relief/shared-risk-engine";

/** Mirrors `@sweeps-relief/shared-rules` bundle shape without a compile-time dep on that package. */
export interface RulesBundle {
  scoring: ScoringConfig;
  knownDomains: KnownDomainsConfig;
  riskTerms: RiskTermsConfig;
  protectedPatterns: ProtectedPatternsConfig;
}

export interface PasteDefenseInput {
  pageUrl: string;
  hostname: string;
  pageTitle: string;
  visibleTextSample: string;
  field: FieldMetadata;
  clipboardText: string;
  rules: RulesBundle;
  pageContext?: PageContextAugment;
  policy?: RiskPolicyOverrides;
}

export function evaluatePasteDefense(input: PasteDefenseInput): RiskResult {
  const { rules } = input;
  return evaluateRisk({
    pageUrl: input.pageUrl,
    hostname: input.hostname,
    pageTitle: input.pageTitle,
    visibleTextSample: input.visibleTextSample,
    field: input.field,
    protectedTextCandidate: input.clipboardText,
    knownDomains: rules.knownDomains,
    riskTerms: rules.riskTerms,
    protectedPatterns: rules.protectedPatterns,
    scoring: rules.scoring,
    pageContext: input.pageContext,
    policy: input.policy,
  });
}

export function evaluateSubmitDefense(input: PasteDefenseInput): RiskResult {
  const { rules } = input;
  return evaluateSubmitRisk({
    pageUrl: input.pageUrl,
    hostname: input.hostname,
    pageTitle: input.pageTitle,
    visibleTextSample: input.visibleTextSample,
    field: input.field,
    protectedTextCandidate: input.clipboardText,
    knownDomains: rules.knownDomains,
    riskTerms: rules.riskTerms,
    protectedPatterns: rules.protectedPatterns,
    scoring: rules.scoring,
    pageContext: input.pageContext,
    policy: input.policy,
  });
}

export function pasteShouldBeBlocked(result: RiskResult): boolean {
  return (
    result.action === "block_paste" ||
    result.action === "redact_and_block" ||
    result.action === "block_input"
  );
}

export function typingShouldBeBlocked(result: RiskResult): boolean {
  return (
    result.action === "block_input" ||
    result.action === "redact_and_block"
  );
}

export function submitShouldBlock(result: RiskResult): boolean {
  return result.action === "block_submit";
}

export function submitShouldWarn(result: RiskResult): boolean {
  return result.action === "warn_only";
}
