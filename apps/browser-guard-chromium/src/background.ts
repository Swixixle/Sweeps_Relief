import type { DefenseReceipt } from "@sweeps-relief/shared-receipts";

const RECEIPTS_KEY = "recentReceipts";
const BLOCK_COUNT_KEY = "blockCount";
const MAX_RECEIPTS = 200;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "sweeps:blocked") {
    void chrome.storage.local.get(BLOCK_COUNT_KEY).then((cur) => {
      const n = typeof cur[BLOCK_COUNT_KEY] === "number" ? cur[BLOCK_COUNT_KEY] + 1 : 1;
      void chrome.storage.local.set({ [BLOCK_COUNT_KEY]: n });
    });
    sendResponse({ ok: true });
    return true;
  }
  if (msg?.type === "sweeps:receipt" && msg.receipt) {
    const receipt = msg.receipt as DefenseReceipt;
    void chrome.storage.local.get(RECEIPTS_KEY).then((cur) => {
      const list = Array.isArray(cur[RECEIPTS_KEY])
        ? (cur[RECEIPTS_KEY] as DefenseReceipt[])
        : [];
      list.push(receipt);
      while (list.length > MAX_RECEIPTS) list.shift();
      void chrome.storage.local.set({ [RECEIPTS_KEY]: list });
    });
    sendResponse({ ok: true });
    return true;
  }
  sendResponse({ ok: false });
  return false;
});
