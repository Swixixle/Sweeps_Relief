import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { RiskResult } from "@sweeps-relief/shared-risk-engine";
import { appendReceiptJsonlFile } from "./receipt-file.js";
import { buildReceipt, receiptToJsonLine } from "./receipt.js";

const sampleResult: RiskResult = {
  page_risk_score: 40,
  field_risk_score: 20,
  protected_match_type: "email",
  action: "block_paste",
  triggered_terms: ["sweeps"],
  risk_reasons: [],
  page_risk_reasons: ["page_term:sweeps"],
  field_risk_reasons: [],
  rule_version: "1.0.0",
  surface_type: "signup_surface",
};

describe("receipts", () => {
  it("serializes a line of JSON", () => {
    const r = buildReceipt({
      pageUrl: "https://a.test/x",
      hostname: "a.test",
      title: "T",
      field: { name: "email" },
      result: sampleResult,
      source: "test",
    });
    const line = receiptToJsonLine(r);
    const parsed = JSON.parse(line.trim()) as Record<string, unknown>;
    expect(parsed.action).toBe("block_paste");
    expect(parsed.rule_version).toBe("1.0.0");
    expect(parsed.surface_type).toBe("signup_surface");
  });

  it("includes optional submit_intercepted", () => {
    const r = buildReceipt({
      pageUrl: "https://a.test/",
      hostname: "a.test",
      title: "T",
      field: {},
      result: { ...sampleResult, action: "block_submit" },
      source: "test",
      submitIntercepted: true,
    });
    expect(r.submit_intercepted).toBe(true);
    expect(r.action).toBe("block_submit");
  });

  it("appends to a jsonl file", () => {
    const dir = join(process.cwd(), "node_modules", ".cache", "sweeps-receipts-test");
    mkdirSync(dir, { recursive: true });
    const path = join(dir, "receipts.jsonl");
    rmSync(path, { force: true });
    const r = buildReceipt({
      pageUrl: "https://b.test/",
      hostname: "b.test",
      title: "T",
      field: {},
      result: sampleResult,
      source: "test",
    });
    appendReceiptJsonlFile(path, r);
    const text = readFileSync(path, "utf8");
    expect(JSON.parse(text.trim()).hostname).toBe("b.test");
  });
});
