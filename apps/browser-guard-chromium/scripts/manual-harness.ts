/**
 * Manual checkpoint: same inputs the Chromium content script would see,
 * without loading the browser. Reads fixture HTML from disk.
 *
 * Run: npm run harness --workspace=@sweeps-relief/browser-guard-chromium
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FieldMetadata, PageContextAugment } from "@sweeps-relief/shared-risk-engine";
import { bundledRules } from "../src/bundledRules.js";
import {
  evaluatePasteForContext,
  evaluateSubmitForContext,
  makeReceiptFromPaste,
  shouldPreventPaste,
} from "../src/pasteFlow.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "..", "fixtures");

const TEST_EMAIL = "checkpoint-user@example.com";

function extractPageParts(html: string): { title: string; visibleTextSample: string } {
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

function formBlockFromHtml(html: string): string | undefined {
  const m = html.match(/<form[^>]*>([\s\S]*?)<\/form>/i);
  if (!m) return undefined;
  return m[1]
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
}

function runCase(
  name: string,
  pageUrl: string,
  hostname: string,
  html: string,
  field: FieldMetadata,
  pageContext?: PageContextAugment,
): { total: number; result: ReturnType<typeof evaluatePasteForContext> } {
  const { title, visibleTextSample } = extractPageParts(html);
  const ctx = {
    rules: bundledRules,
    pageUrl,
    hostname,
    pageTitle: title,
    visibleTextSample,
    field,
    clipboardText: TEST_EMAIL,
    pageContext,
  };
  const result = evaluatePasteForContext(ctx);
  const receipt = makeReceiptFromPaste(ctx, result);
  console.log(`\n--- ${name} ---`);
  console.log(
    JSON.stringify(
      {
        action: result.action,
        page_risk_score: result.page_risk_score,
        field_risk_score: result.field_risk_score,
        prevent_paste: shouldPreventPaste(result),
      },
      null,
      2,
    ),
  );
  console.log("Sample receipt JSON:", JSON.stringify(receipt));
  return { total: result.page_risk_score + result.field_risk_score, result };
}

const benignHtml = readFileSync(join(fixturesDir, "benign.html"), "utf8");
const riskyHtml = readFileSync(join(fixturesDir, "risky.html"), "utf8");
const cashierHtml = readFileSync(join(fixturesDir, "high_risk_cashier.html"), "utf8");
const loginHtml = readFileSync(join(fixturesDir, "login_surface.html"), "utf8");
const loginParts = extractPageParts(loginHtml);

console.log("Harness email:", TEST_EMAIL);

runCase("benign fixture", "http://127.0.0.1:8765/benign.html", "127.0.0.1", benignHtml, {
  name: "q",
  id: "search",
  placeholder: "Search articles",
});

const risky = runCase("risky fixture", "http://127.0.0.1:8765/risky.html", "127.0.0.1", riskyHtml, {
  name: "email",
  id: "signup-email",
  placeholder: "Email for registration",
});

const cashierForm = formBlockFromHtml(cashierHtml);
const cashier = runCase(
  "high_risk_cashier fixture",
  "http://127.0.0.1:8765/high_risk_cashier.html",
  "127.0.0.1",
  cashierHtml,
  {
    name: "billing_email",
    id: "wallet-email",
    className: "kyc-field wallet-input",
    placeholder: "Email for billing and wallet",
    autocomplete: "email",
    labelText: "Billing email for redemption",
    nearbyHeadingText: "Cashier & billing Verify identity",
    nearbyButtonText: "Deposit to wallet Redeem sweeps cash",
    formAction: "/api/wallet/deposit",
    formContextSnippet: cashierForm,
  },
  { formBlockText: cashierForm },
);

const loginForm = formBlockFromHtml(loginHtml);
const loginPaste = runCase(
  "login_surface (paste eval)",
  "http://127.0.0.1:8765/login_surface.html",
  "127.0.0.1",
  loginHtml,
  {
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
    formContextSnippet: loginForm,
  },
  { formBlockText: loginForm },
);

const submitCtx = {
  rules: bundledRules,
  pageUrl: "http://127.0.0.1:8765/login_surface.html",
  hostname: "127.0.0.1",
  pageTitle: loginParts.title,
  visibleTextSample: loginParts.visibleTextSample,
  field: {
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
    formContextSnippet: loginForm,
  },
  clipboardText: `${TEST_EMAIL}\nnot-a-real-password`,
  pageContext: { formBlockText: loginForm },
};
const submitResult = evaluateSubmitForContext(submitCtx);
console.log("\n--- login_surface (submit eval) ---");
console.log(
  JSON.stringify(
    {
      surface_type: submitResult.surface_type,
      action: submitResult.action,
      page_risk_score: submitResult.page_risk_score,
      field_risk_score: submitResult.field_risk_score,
    },
    null,
    2,
  ),
);
console.log("Submit receipt sample:", JSON.stringify(makeReceiptFromPaste(submitCtx, submitResult, { submitIntercepted: true })));

console.log(
  `\nCheck: cashier combined risk (${cashier.total}) vs risky signup (${risky.total}) — cashier should be higher.`,
);
console.log(
  "Expected: benign → allow; risky → block/redact; cashier highest; login → login_surface + submit allow|warn|block_submit.\n",
);
