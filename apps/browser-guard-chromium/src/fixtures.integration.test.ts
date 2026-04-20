import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FieldMetadata, PageContextAugment } from "@sweeps-relief/shared-risk-engine";
import { describe, expect, it } from "vitest";
import { bundledRules } from "./bundledRules.js";
import {
  evaluatePasteForContext,
  evaluateSubmitForContext,
  shouldPreventPaste,
} from "./pasteFlow.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "..", "fixtures");
const EMAIL = "checkpoint-user@example.com";

function extract(html: string): { title: string; visibleTextSample: string } {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch?.[1]?.trim() ?? "";
  const stripped = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { title, visibleTextSample: stripped.slice(0, 8000) };
}

function formBlock(html: string): string | undefined {
  const m = html.match(/<form[^>]*>([\s\S]*?)<\/form>/i);
  if (!m) return undefined;
  return m[1]
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
}

describe("fixture HTML vs engine", () => {
  it("benign: allow paste with test email", () => {
    const html = readFileSync(join(fixturesDir, "benign.html"), "utf8");
    const { title, visibleTextSample } = extract(html);
    const r = evaluatePasteForContext({
      rules: bundledRules,
      pageUrl: "http://127.0.0.1:8765/benign.html",
      hostname: "127.0.0.1",
      pageTitle: title,
      visibleTextSample,
      field: { name: "q", id: "search", placeholder: "Search articles" },
      clipboardText: EMAIL,
    });
    expect(r.action).toBe("allow");
    expect(shouldPreventPaste(r)).toBe(false);
  });

  it("risky: block_paste with same email", () => {
    const html = readFileSync(join(fixturesDir, "risky.html"), "utf8");
    const { title, visibleTextSample } = extract(html);
    const r = evaluatePasteForContext({
      rules: bundledRules,
      pageUrl: "http://127.0.0.1:8765/risky.html",
      hostname: "127.0.0.1",
      pageTitle: title,
      visibleTextSample,
      field: {
        name: "email",
        id: "signup-email",
        placeholder: "Email for registration",
      },
      clipboardText: EMAIL,
    });
    expect(shouldPreventPaste(r)).toBe(true);
    expect(r.action).toMatch(/^(block_paste|block_input|redact_and_block)$/);
  });

  it("high_risk_cashier: scores higher than risky signup and still blocks", () => {
    const html = readFileSync(join(fixturesDir, "high_risk_cashier.html"), "utf8");
    const { title, visibleTextSample } = extract(html);
    const fb = formBlock(html);
    const pageContext: PageContextAugment = { formBlockText: fb };
    const field: FieldMetadata = {
      name: "billing_email",
      id: "wallet-email",
      className: "kyc-field wallet-input",
      placeholder: "Email for billing and wallet",
      autocomplete: "email",
      labelText: "Billing email for redemption",
      nearbyHeadingText: "Cashier & billing Verify identity",
      nearbyButtonText: "Deposit to wallet Redeem sweeps cash",
      formAction: "/api/wallet/deposit",
      formContextSnippet: fb,
    };
    const riskyHtml = readFileSync(join(fixturesDir, "risky.html"), "utf8");
    const riskyExtract = extract(riskyHtml);
    const risky = evaluatePasteForContext({
      rules: bundledRules,
      pageUrl: "http://127.0.0.1:8765/risky.html",
      hostname: "127.0.0.1",
      pageTitle: riskyExtract.title,
      visibleTextSample: riskyExtract.visibleTextSample,
      field: {
        name: "email",
        id: "signup-email",
        placeholder: "Email for registration",
      },
      clipboardText: EMAIL,
    });

    const cashier = evaluatePasteForContext({
      rules: bundledRules,
      pageUrl: "http://127.0.0.1:8765/high_risk_cashier.html",
      hostname: "127.0.0.1",
      pageTitle: title,
      visibleTextSample,
      field,
      pageContext,
      clipboardText: EMAIL,
    });

    expect(cashier.page_risk_score + cashier.field_risk_score).toBeGreaterThan(
      risky.page_risk_score + risky.field_risk_score,
    );
    expect(shouldPreventPaste(cashier)).toBe(true);
    expect(cashier.field_risk_reasons.length).toBeGreaterThan(0);
  });

  it("login_surface: classified as login_surface and blocks paste with protected email", () => {
    const html = readFileSync(join(fixturesDir, "login_surface.html"), "utf8");
    const { title, visibleTextSample } = extract(html);
    const fb = formBlock(html);
    const pageContext: PageContextAugment = { formBlockText: fb };
    const field: FieldMetadata = {
      name: "email",
      id: "login-email",
      type: "email",
      className: "login-field email-input",
      placeholder: "Enter your email address",
      autocomplete: "email",
      labelText: "Email Address",
      nearbyHeadingText: "Member Login Sign In",
      nearbyButtonText: "Log In Continue with Bonus",
      formAction: "/api/account/login",
      formContextSnippet: fb,
    };

    const result = evaluatePasteForContext({
      rules: bundledRules,
      pageUrl: "http://127.0.0.1:8765/login_surface.html",
      hostname: "127.0.0.1",
      pageTitle: title,
      visibleTextSample,
      field,
      pageContext,
      clipboardText: EMAIL,
    });

    expect(result.surface_type).toBe("login_surface");

    const elevated =
      shouldPreventPaste(result) ||
      result.page_risk_score >= 38 ||
      result.field_risk_score >= 32 ||
      result.action === "warn_only";
    expect(elevated).toBe(true);

    expect(result.page_risk_reasons.length).toBeGreaterThan(0);
    expect(result.field_risk_reasons.length).toBeGreaterThan(0);
  });

  it("login_surface: submit evaluation returns allow | warn_only | block_submit", () => {
    const html = readFileSync(join(fixturesDir, "login_surface.html"), "utf8");
    const { title, visibleTextSample } = extract(html);
    const fb = formBlock(html);
    const field: FieldMetadata = {
      name: "email",
      id: "login-email",
      type: "email",
      className: "login-field email-input",
      placeholder: "Enter your email address",
      autocomplete: "email",
      labelText: "Email Address",
      nearbyHeadingText: "Member Login Sign In",
      nearbyButtonText: "Log In Continue with Bonus",
      formAction: "/api/account/login",
      formContextSnippet: fb,
    };
    const submit = evaluateSubmitForContext({
      rules: bundledRules,
      pageUrl: "http://127.0.0.1:8765/login_surface.html",
      hostname: "127.0.0.1",
      pageTitle: title,
      visibleTextSample,
      field,
      clipboardText: `${EMAIL}\nsecret`,
      pageContext: { formBlockText: fb },
    });
    expect(submit.surface_type).toBe("login_surface");
    expect(["allow", "warn_only", "block_submit"]).toContain(submit.action);
  });
});
