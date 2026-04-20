import { describe, expect, it } from "vitest";
import type { RulesBundle } from "@sweeps-relief/shared-rules";
import { loadDefaultRules } from "@sweeps-relief/shared-rules";
import { evaluatePasteDefense, pasteShouldBeBlocked } from "./pasteDefense.js";

const rules: RulesBundle = loadDefaultRules(import.meta.url);

describe("evaluatePasteDefense", () => {
  it("allows benign page with email paste", () => {
    const r = evaluatePasteDefense({
      pageUrl: "https://news.example/",
      hostname: "news.example",
      pageTitle: "Headlines",
      visibleTextSample: "Weather and traffic",
      field: { name: "q" },
      clipboardText: "reader@news.example",
      rules,
    });
    expect(r.protected_match_type).toBe("email");
    expect(pasteShouldBeBlocked(r)).toBe(false);
    expect(r.action).toBe("allow");
  });

  it("blocks email on high-risk sweeps-like page", () => {
    const r = evaluatePasteDefense({
      pageUrl: "https://play.example/register",
      hostname: "play.example",
      pageTitle: "Sweeps register bonus",
      visibleTextSample:
        "sweepstakes register bonus deposit promotions login cashier wallet verify identity sportsbook poker",
      field: { name: "email", id: "reg-email", placeholder: "Email for registration" },
      clipboardText: "you@domain.com",
      rules,
    });
    expect(pasteShouldBeBlocked(r)).toBe(true);
  });
});
