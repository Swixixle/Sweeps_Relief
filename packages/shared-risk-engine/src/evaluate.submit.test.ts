import { describe, expect, it } from "vitest";
import { evaluateSubmitRisk } from "./evaluate.js";
import type {
  KnownDomainsConfig,
  ProtectedPatternsConfig,
  RiskEngineInput,
  RiskTermsConfig,
  ScoringConfig,
} from "./types.js";

const scoring: ScoringConfig = {
  rule_version: "t",
  thresholds: {
    warn_only_min: 12,
    high_page: 38,
    high_field: 32,
    very_high_page: 62,
    very_high_field: 52,
    redact_page: 99,
    redact_field: 99,
  },
  weights: {
    domain_match: 48,
    page_term_hit: 6,
    page_term_cap: 42,
    field_term_hit: 9,
    field_term_cap: 40,
    field_sensitive_bonus: 12,
  },
  sensitive_field_substrings: ["password", "card", "ssn"],
  combo_risk: { pairs: [], weight_per_pair: 12, max_combo_bonus: 0 },
  field_boost_terms: [{ match: "email", weight: 4 }],
  field_boost_cap: 36,
  submit_interception: {
    enabled: true,
    warn_min_score: 20,
    warn_min_page: 15,
    warn_min_field: 15,
    block_submit_min_score: 45,
    min_page_for_block: 30,
    min_field_for_block: 30,
  },
};

const terms: RiskTermsConfig = { terms: ["sweeps", "login", "wallet"] };
const patterns: ProtectedPatternsConfig = {
  patterns: {
    email: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
  },
};
const known: KnownDomainsConfig = { hostnames: [], hostname_suffixes: [] };

function input(p: Partial<RiskEngineInput>): RiskEngineInput {
  return {
    pageUrl: "https://play.example/login",
    hostname: "play.example",
    pageTitle: "Login",
    visibleTextSample: "sweeps wallet bonus login",
    field: {
      type: "email",
      name: "email",
      labelText: "Email",
      nearbyButtonText: "Log In",
    },
    protectedTextCandidate: "u@x.com",
    knownDomains: known,
    riskTerms: terms,
    protectedPatterns: patterns,
    scoring,
    ...p,
  };
}

describe("evaluateSubmitRisk", () => {
  it("returns allow on non-intercept surfaces when risk is low", () => {
    const r = evaluateSubmitRisk(
      input({
        pageTitle: "Weather",
        visibleTextSample: "forecast",
        field: { name: "q" },
        protectedTextCandidate: "",
      }),
    );
    expect(r.action).toBe("allow");
  });

  it("returns block_submit when surface is login, PII present, scores exceed floors", () => {
    const r = evaluateSubmitRisk(
      input({
        protectedTextCandidate: "checkpoint-user@example.com\nsecret",
        visibleTextSample:
          "sweeps wallet redeem login bonus sweeps cash account cashout",
        pageTitle: "Login — Sweeps",
        field: {
          type: "email",
          name: "email",
          id: "login-email",
          labelText: "Email Address",
          nearbyHeadingText: "Member Login",
          nearbyButtonText: "Log In Continue",
          formAction: "/api/account/login",
        },
      }),
    );
    expect(["block_submit", "warn_only"]).toContain(r.action);
    expect(r.surface_type).toBe("login_surface");
  });
});
