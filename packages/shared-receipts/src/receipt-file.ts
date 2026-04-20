import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { DefenseReceipt } from "./types.js";
import { receiptToJsonLine } from "./receipt.js";

export function appendReceiptJsonlFile(path: string, receipt: DefenseReceipt): void {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, receiptToJsonLine(receipt), "utf8");
}
