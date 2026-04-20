import { describe, expect, it } from "vitest";
import { bundledRules } from "./bundledRules.js";
import {
  evaluatePasteForContext,
  makeReceiptFromPaste,
  shouldPreventPaste,
} from "./pasteFlow.js";

describe("Chromium paste interception path", () => {
  it("allows benign page", () => {
    const r = evaluatePasteForContext({
      rules: bundledRules,
      pageUrl: "https://example.org/",
      hostname: "example.org",
      pageTitle: "News",
      visibleTextSample: "Local headlines",
      field: { name: "q" },
      clipboardText: "reader@example.org",
    });
    expect(shouldPreventPaste(r)).toBe(false);
  });

  it("blocks protected paste on high-risk page", () => {
    const r = evaluatePasteForContext({
      rules: bundledRules,
      pageUrl: "https://play.example/register",
      hostname: "play.example",
      pageTitle: "Sweeps register bonus",
      visibleTextSample:
        "sweepstakes register bonus deposit promotions login cashier wallet verify identity sportsbook poker wallet bingo",
      field: { name: "email", placeholder: "Email for registration" },
      clipboardText: "you@there.com",
    });
    expect(shouldPreventPaste(r)).toBe(true);
  });

  describe("surface classification", () => {
    it("classifies benign page as benign_form", () => {
      const r = evaluatePasteForContext({
        rules: bundledRules,
        pageUrl: "https://example.org/",
        hostname: "example.org",
        pageTitle: "Local News — Weather",
        visibleTextSample: "Local forecast and traffic updates for your area.",
        field: { name: "q", id: "search", placeholder: "Search articles" },
        clipboardText: "reader@example.org",
      });
      expect(r.surface_type).toBe("benign_form");
    });

    it("classifies signup page as signup_surface", () => {
      const r = evaluatePasteForContext({
        rules: bundledRules,
        pageUrl: "https://play.example/register",
        hostname: "play.example",
        pageTitle: "Sweeps register bonus",
        visibleTextSample: "sweepstakes register bonus deposit promotions",
        field: { name: "email", id: "signup-email", placeholder: "Email for registration" },
        clipboardText: "you@there.com",
      });
      expect(r.surface_type).toBe("signup_surface");
    });

    it("classifies login page as login_surface", () => {
      const r = evaluatePasteForContext({
        rules: bundledRules,
        pageUrl: "https://play.example/login",
        hostname: "play.example",
        pageTitle: "Login — Sweeps Account Access",
        visibleTextSample: "Sign in to your sweeps account",
        field: {
          name: "email",
          id: "login-email",
          type: "email",
          placeholder: "Enter your email",
          nearbyHeadingText: "Member Login",
          nearbyButtonText: "Log In Continue",
        },
        clipboardText: "user@example.com",
      });
      expect(r.surface_type).toBe("login_surface");
    });

    it("classifies cashier page as cashier_surface", () => {
      const r = evaluatePasteForContext({
        rules: bundledRules,
        pageUrl: "https://play.example/cashier",
        hostname: "play.example",
        pageTitle: "Wallet — Deposit & Redeem",
        visibleTextSample: "Cashier wallet deposit redeem sweeps coins",
        field: {
          name: "billing_email",
          id: "wallet-email",
          placeholder: "Email for billing and wallet",
          nearbyHeadingText: "Cashier & billing",
          nearbyButtonText: "Deposit to wallet Redeem",
        },
        clipboardText: "user@example.com",
      });
      expect(r.surface_type).toBe("cashier_surface");
    });

    it("classifies KYC page as kyc_surface", () => {
      const r = evaluatePasteForContext({
        rules: bundledRules,
        pageUrl: "https://play.example/verify",
        hostname: "play.example",
        pageTitle: "Verify Identity — KYC",
        visibleTextSample: "verify identity KYC document verification",
        field: {
          name: "identity_email",
          id: "kyc-email",
          placeholder: "Email for identity verification",
          nearbyHeadingText: "Verify Identity",
          nearbyButtonText: "Submit Verification",
        },
        clipboardText: "user@example.com",
      });
      expect(r.surface_type).toBe("kyc_surface");
    });
  });

  describe("receipt schema", () => {
    it("includes surface_type in receipt", () => {
      const r = evaluatePasteForContext({
        rules: bundledRules,
        pageUrl: "https://play.example/login",
        hostname: "play.example",
        pageTitle: "Login",
        visibleTextSample: "Sign in to account",
        field: { name: "email", type: "email" },
        clipboardText: "user@example.com",
      });
      const ctx = {
        rules: bundledRules,
        pageUrl: "https://play.example/login",
        hostname: "play.example",
        pageTitle: "Login",
        visibleTextSample: "Sign in to account",
        field: { name: "email", type: "email" },
        clipboardText: "user@example.com",
      };
      const receipt = makeReceiptFromPaste(ctx, r);
      expect(receipt.surface_type).toBeDefined();
      expect(receipt.surface_type).toBe(r.surface_type);
    });

    it("includes submit_intercepted when specified", () => {
      const r = evaluatePasteForContext({
        rules: bundledRules,
        pageUrl: "https://play.example/login",
        hostname: "play.example",
        pageTitle: "Login",
        visibleTextSample: "Sign in to account",
        field: { name: "email", type: "email" },
        clipboardText: "user@example.com",
      });
      const ctx = {
        rules: bundledRules,
        pageUrl: "https://play.example/login",
        hostname: "play.example",
        pageTitle: "Login",
        visibleTextSample: "Sign in to account",
        field: { name: "email", type: "email" },
        clipboardText: "user@example.com",
      };
      const receipt = makeReceiptFromPaste(ctx, r, { submitIntercepted: true });
      expect(receipt.submit_intercepted).toBe(true);
    });

    it("includes page_risk_reasons and field_risk_reasons", () => {
      const r = evaluatePasteForContext({
        rules: bundledRules,
        pageUrl: "https://play.example/login",
        hostname: "play.example",
        pageTitle: "Sweeps Login",
        visibleTextSample: "sweepstakes login cashier wallet",
        field: { name: "email", type: "email" },
        clipboardText: "user@example.com",
      });
      const ctx = {
        rules: bundledRules,
        pageUrl: "https://play.example/login",
        hostname: "play.example",
        pageTitle: "Sweeps Login",
        visibleTextSample: "sweepstakes login cashier wallet",
        field: { name: "email", type: "email" },
        clipboardText: "user@example.com",
      };
      const receipt = makeReceiptFromPaste(ctx, r);
      expect(receipt.page_risk_reasons).toBeDefined();
      expect(receipt.field_risk_reasons).toBeDefined();
      expect(Array.isArray(receipt.page_risk_reasons)).toBe(true);
      expect(Array.isArray(receipt.field_risk_reasons)).toBe(true);
    });
  });
});
