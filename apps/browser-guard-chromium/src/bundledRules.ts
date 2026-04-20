import type { RulesBundle } from "@sweeps-relief/browser-guard-core";
import knownDomains from "../../../config/known_high_risk_domains.json";
import protectedPatterns from "../../../config/protected_patterns.example.json";
import riskTerms from "../../../config/risk_terms.json";
import scoring from "../../../config/scoring.json";

export const bundledRules: RulesBundle = {
  scoring,
  knownDomains,
  riskTerms,
  protectedPatterns,
};
