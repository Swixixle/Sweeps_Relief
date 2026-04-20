import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  KnownDomainsConfig,
  ProtectedPatternsConfig,
  RiskTermsConfig,
  ScoringConfig,
} from "@sweeps-relief/shared-risk-engine";

export interface RulesBundle {
  scoring: ScoringConfig;
  knownDomains: KnownDomainsConfig;
  riskTerms: RiskTermsConfig;
  protectedPatterns: ProtectedPatternsConfig;
}

/** Resolve `config/` next to the repository root when running from built `dist/`. */
export function defaultConfigDir(importMetaUrl: string): string {
  const here = dirname(fileURLToPath(importMetaUrl));
  return join(here, "..", "..", "..", "config");
}

export function loadRulesFromDir(configDir: string): RulesBundle {
  const scoring = JSON.parse(
    readFileSync(join(configDir, "scoring.json"), "utf8"),
  ) as ScoringConfig;
  const knownDomains = JSON.parse(
    readFileSync(join(configDir, "known_high_risk_domains.json"), "utf8"),
  ) as KnownDomainsConfig;
  const riskTerms = JSON.parse(
    readFileSync(join(configDir, "risk_terms.json"), "utf8"),
  ) as RiskTermsConfig;
  const protectedPatterns = JSON.parse(
    readFileSync(join(configDir, "protected_patterns.example.json"), "utf8"),
  ) as ProtectedPatternsConfig;
  return { scoring, knownDomains, riskTerms, protectedPatterns };
}

export function loadDefaultRules(importMetaUrl: string): RulesBundle {
  return loadRulesFromDir(defaultConfigDir(importMetaUrl));
}
