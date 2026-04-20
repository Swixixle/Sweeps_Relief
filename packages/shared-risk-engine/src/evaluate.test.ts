import { describe, expect, it } from "vitest";
import { debugEvaluationShape } from "./debug.js";
import {
  classifySurface,
  detectProtectedMatch,
  evaluateRisk,
  matchesKnownDomain,
} from "./evaluate.js";
import type {
  KnownDomainsConfig,
  ProtectedPatternsConfig,
  RiskEngineInput,
  ScoringConfig,
  RiskTermsConfig,
} from "./types.js";

const baseScoring: ScoringConfig = {
  rule_version: "test",
  thresholds: {
    warn_only_min: 12,
    high_page: 38,
    high_field: 32,
    very_high_page: 62,
    very_high_field: 52,
    redact_page: 78,
    redact_field: 72,
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
  field_boost_terms: [
    { match: "verify", weight: 7 },
    { match: "wallet", weight: 10 },
    { match: "billing", weight: 8 },
    { match: "cashier", weight: 10 },
    { match: "redeem", weight: 8 },
    { match: "kyc", weight: 12 },
    { match: "deposit", weight: 9 },
  ],
  field_boost_cap: 36,
};

const minimalTerms: RiskTermsConfig = { terms: [] };

const sweepsTerms: RiskTermsConfig = {
  terms: [
    "sweeps",
    "sweepstakes",
    "register",
    "sign up",
    "login",
    "cashier",
    "verify identity",
    "bonus",
    "deposit",
    "promotions",
    "sportsbook",
    "poker",
    "wallet",
    "bingo",
  ],
};

const patterns: ProtectedPatternsConfig = {
  patterns: {
    email: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
    phone: "\\+?1?[-.\\s]?\\(?[0-9]{3}\\)?[-.\\s]?[0-9]{3}[-.\\s]?[0-9]{4}",
    card_adjacent: "\\b(?:\\d{4}[-\\s]?){3}\\d{4}\\b",
    dob: "\\b(?:0?[1-9]|1[0-2])[/-](?:0?[1-9]|[12][0-9]|3[01])[/-](?:19|20)?\\d{2}\\b",
    address: "\\b\\d{1,5}\\s+\\w+\\s+(?:st|street)\\b",
    full_name: "\\b[A-Z][a-z]+\\s+[A-Z][a-z]+\\b",
  },
};

function input(partial: Partial<RiskEngineInput>): RiskEngineInput {
  return {
    pageUrl: "https://example.com/",
    hostname: "example.com",
    pageTitle: "",
    visibleTextSample: "",
    field: {},
    protectedTextCandidate: "",
    knownDomains: { hostnames: [], hostname_suffixes: [] },
    riskTerms: minimalTerms,
    protectedPatterns: patterns,
    scoring: baseScoring,
    ...partial,
  };
}

describe("matchesKnownDomain", () => {
  it("matches exact hostname and normalizes www", () => {
    const k: KnownDomainsConfig = { hostnames: ["bad.example"] };
    expect(matchesKnownDomain("bad.example", k)).toBe(true);
    expect(matchesKnownDomain("www.bad.example", k)).toBe(true);
  });

  it("matches suffix", () => {
    const k: KnownDomainsConfig = {
      hostnames: [],
      hostname_suffixes: [".risk.test"],
    };
    expect(matchesKnownDomain("app.risk.test", k)).toBe(true);
  });
});

describe("detectProtectedMatch", () => {
  it("detects email", () => {
    expect(detectProtectedMatch("reach me at a@b.co", patterns)).toBe("email");
  });

  it("returns none for empty", () => {
    expect(detectProtectedMatch("", patterns)).toBe("none");
  });
});

describe("evaluateRisk", () => {
  it("allows protected email on benign page", () => {
    const r = evaluateRisk(
      input({
        protectedTextCandidate: "user@company.com",
        pageTitle: "Weather",
        visibleTextSample: "Local forecast",
        field: { name: "q", id: "search" },
      }),
    );
    expect(r.protected_match_type).toBe("email");
    expect(r.action).toBe("allow");
  });

  it("blocks paste for high-risk signup context", () => {
    const r = evaluateRisk(
      input({
        protectedTextCandidate: "user@company.com",
        pageTitle: "Sweeps signup — register today",
        visibleTextSample:
          "sweepstakes register bonus deposit promotions login cashier wallet verify identity sportsbook poker",
        field: {
          name: "email",
          id: "signup-email",
          placeholder: "Email for registration and login",
        },
        riskTerms: sweepsTerms,
      }),
    );
    expect(r.protected_match_type).toBe("email");
    expect(["block_paste", "block_input", "redact_and_block"]).toContain(r.action);
  });

  it("warns on risky page without protected payload", () => {
    const r = evaluateRisk(
      input({
        protectedTextCandidate: "plain-text-without-pii-match-xyz",
        pageTitle: "Casino promotions",
        visibleTextSample: "sweepstakes bonus login",
        field: { name: "x" },
        riskTerms: sweepsTerms,
      }),
    );
    expect(r.protected_match_type).toBe("none");
    expect(r.action).toBe("warn_only");
  });

  it("escalates to block_input on very high risk", () => {
    const known: KnownDomainsConfig = { hostnames: ["very-bad-sweeps.example"] };
    const r = evaluateRisk(
      input({
        hostname: "very-bad-sweeps.example",
        protectedTextCandidate: "user@company.com",
        pageTitle: "Cashier — verify identity",
        visibleTextSample:
          "sweeps sweepstakes deposit bonus promotions register sign up login cashier wallet poker sportsbook bingo fish game",
        field: {
          name: "kyc_ssn",
          id: "verify-identity",
          placeholder: "Verify identity for cashier",
        },
        knownDomains: known,
        riskTerms: sweepsTerms,
      }),
    );
    expect(["block_input", "redact_and_block"]).toContain(r.action);
  });

  it("uses known domain to raise page score", () => {
    const known: KnownDomainsConfig = { hostnames: ["evil-sweeps.example"] };
    const r = evaluateRisk(
      input({
        hostname: "evil-sweeps.example",
        protectedTextCandidate: "x@y.z",
        pageTitle: "Hi",
        visibleTextSample: "welcome",
        field: { name: "email" },
        knownDomains: known,
        riskTerms: sweepsTerms,
      }),
    );
    expect(r.page_risk_score).toBeGreaterThanOrEqual(baseScoring.thresholds.high_page);
    expect(r.action).not.toBe("allow");
  });

  it("increases field score from label and button context", () => {
    const r = evaluateRisk(
      input({
        protectedTextCandidate: "user@company.com",
        pageTitle: "Wallet",
        visibleTextSample: "manage your account",
        field: {
          name: "email",
          labelText: "Verify identity — billing email",
          nearbyButtonText: "Deposit to wallet redeem",
          nearbyHeadingText: "Cashier",
        },
        riskTerms: sweepsTerms,
      }),
    );
    expect(r.field_risk_reasons.some((x) => x.startsWith("field_lexicon:"))).toBe(true);
    expect(r.field_risk_score).toBeGreaterThan(20);
  });

  it("applies combo pairs on page haystack", () => {
    const r = evaluateRisk(
      input({
        protectedTextCandidate: "x@y.z",
        pageTitle: "Offer",
        visibleTextSample: "register here for sweeps access",
        field: {},
        riskTerms: sweepsTerms,
        scoring: {
          ...baseScoring,
          combo_risk: {
            pairs: [["register", "sweeps"]],
            weight_per_pair: 20,
            max_combo_bonus: 40,
          },
        },
      }),
    );
    expect(r.page_risk_reasons.some((x) => x.startsWith("combo_match:"))).toBe(true);
    expect(r.triggered_terms.some((t) => t.includes("combo:"))).toBe(true);
  });

  it("downgrades block_input to block_paste when policy disables block input", () => {
    const r = evaluateRisk(
      input({
        protectedTextCandidate: "user@company.com",
        pageTitle: "Quiet page",
        visibleTextSample: "welcome",
        field: {
          name: "kyc_ssn",
          id: "verify-identity",
          placeholder: "Verify identity for cashier wallet billing",
          labelText: "KYC billing verification",
          nearbyButtonText: "Deposit redeem",
        },
        riskTerms: sweepsTerms,
        policy: { block_input_enabled: false },
        scoring: {
          ...baseScoring,
          thresholds: {
            ...baseScoring.thresholds,
            redact_page: 99,
            redact_field: 99,
          },
        },
      }),
    );
    expect(r.action).toBe("block_paste");
  });

  it("exposes debug evaluation shape", () => {
    const r = evaluateRisk(
      input({
        protectedTextCandidate: "a@b.co",
        pageTitle: "Hi",
        field: {},
        riskTerms: sweepsTerms,
      }),
    );
    const dbg = debugEvaluationShape(r);
    expect(dbg).toMatchObject({
      page_risk_score: r.page_risk_score,
      field_risk_score: r.field_risk_score,
      action: r.action,
      protected_match_type: r.protected_match_type,
    });
    expect(Array.isArray(dbg.page_risk_reasons)).toBe(true);
    expect(Array.isArray(dbg.field_risk_reasons)).toBe(true);
  });

  it("returns surface_type in result", () => {
    const r = evaluateRisk(
      input({
        protectedTextCandidate: "a@b.co",
        pageTitle: "Login",
        visibleTextSample: "Sign in to your account",
        field: { name: "email", type: "email" },
        riskTerms: sweepsTerms,
      }),
    );
    expect(r.surface_type).toBeDefined();
    expect(typeof r.surface_type).toBe("string");
  });
});

describe("classifySurface", () => {
  it("classifies search forms as benign_form", () => {
    const surface = classifySurface(
      "https://example.org/search?q=test",
      "Search Results",
      { name: "q", id: "search", placeholder: "Search articles" },
    );
    expect(surface).toBe("benign_form");
  });

  it("classifies signup pages correctly", () => {
    const surface = classifySurface(
      "https://play.example/register",
      "Sign Up — Create Account",
      {
        name: "email",
        id: "signup-email",
        placeholder: "Email for registration",
        nearbyHeadingText: "Register Today",
        nearbyButtonText: "Sign Up Get Started",
      },
    );
    expect(surface).toBe("signup_surface");
  });

  it("classifies login pages correctly", () => {
    const surface = classifySurface(
      "https://play.example/login",
      "Login — Account Access",
      {
        name: "email",
        id: "login-email",
        type: "email",
        placeholder: "Enter your email",
        nearbyHeadingText: "Member Login",
        nearbyButtonText: "Log In Continue",
      },
    );
    expect(surface).toBe("login_surface");
  });

  it("prefers signup when confirm password is present", () => {
    const surface = classifySurface(
      "https://play.example/join",
      "Create Account",
      {
        name: "email",
        type: "email",
        nearbyHeadingText: "Join Now",
        formContextSnippet: "Email Password Confirm Password",
      },
    );
    expect(surface).toBe("signup_surface");
  });

  it("classifies cashier pages correctly", () => {
    const surface = classifySurface(
      "https://play.example/wallet",
      "Wallet — Deposit & Redeem",
      {
        name: "billing_email",
        id: "wallet-email",
        placeholder: "Email for billing and wallet",
        nearbyHeadingText: "Cashier & Billing",
        nearbyButtonText: "Deposit to Wallet Redeem",
        formAction: "/api/wallet/deposit",
      },
    );
    expect(surface).toBe("cashier_surface");
  });

  it("classifies KYC pages correctly", () => {
    const surface = classifySurface(
      "https://play.example/verify",
      "Verify Identity — KYC",
      {
        name: "identity_email",
        id: "kyc-email",
        placeholder: "Email for identity verification",
        nearbyHeadingText: "Verify Identity",
        nearbyButtonText: "Submit Verification",
        formContextSnippet: "Verify identity KYC document",
      },
    );
    expect(surface).toBe("kyc_surface");
  });

  it("prioritizes kyc over cashier when both present", () => {
    const surface = classifySurface(
      "https://play.example/verify",
      "KYC — Verify Identity & Billing",
      {
        name: "kyc_email",
        placeholder: "Email for KYC and wallet",
        nearbyHeadingText: "KYC Verification",
        nearbyButtonText: "Verify Identity Continue",
        formContextSnippet: "KYC verify identity wallet deposit",
      },
    );
    expect(surface).toBe("kyc_surface");
  });

  it("returns unknown_surface when no signals match", () => {
    const surface = classifySurface(
      "https://example.org/page",
      "Some Page",
      { name: "field1" },
    );
    expect(surface).toBe("unknown_surface");
  });
});
