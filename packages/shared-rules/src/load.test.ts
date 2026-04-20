import { describe, expect, it } from "vitest";
import { loadDefaultRules } from "./load.js";

describe("loadDefaultRules", () => {
  it("loads repo config JSON", () => {
    const rules = loadDefaultRules(import.meta.url);
    expect(rules.scoring.rule_version).toBeDefined();
    expect(rules.knownDomains.hostnames.length).toBeGreaterThanOrEqual(0);
    expect(rules.riskTerms.terms.length).toBeGreaterThan(10);
    expect(rules.protectedPatterns.patterns.email).toBeDefined();
  });
});
