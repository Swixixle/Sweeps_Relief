import { bundledRules } from "../bundledRules.js";

const ruleVersionEl = document.getElementById("rule-version");
const exportBtn = document.getElementById("export");
const debugModeEl = document.getElementById("debug-mode") as HTMLInputElement | null;
const blockInputEl = document.getElementById("block-input") as HTMLInputElement | null;
const debugPanel = document.getElementById("debug-panel");
const debugMeta = document.getElementById("debug-meta");

const DEBUG_KEY = "debugMode";
const BLOCK_INPUT_KEY = "blockInputEnabled";

if (ruleVersionEl) {
  ruleVersionEl.textContent = bundledRules.scoring.rule_version;
}

async function refreshDebug(): Promise<void> {
  const sync = await chrome.storage.sync.get([DEBUG_KEY, BLOCK_INPUT_KEY]);
  if (debugModeEl) debugModeEl.checked = sync[DEBUG_KEY] === true;
  if (blockInputEl) blockInputEl.checked = sync[BLOCK_INPUT_KEY] !== false;

  const local = await chrome.storage.local.get(["lastDebugEval", "lastDebugAt"]);
  if (debugPanel) {
    debugPanel.textContent = local.lastDebugEval
      ? JSON.stringify(local.lastDebugEval, null, 2)
      : "(no debug snapshot yet)";
  }
  if (debugMeta && local.lastDebugAt) {
    debugMeta.textContent = `Last snapshot: ${new Date(local.lastDebugAt as number).toISOString()}`;
  }
}

void refreshDebug();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.lastDebugEval) {
    void refreshDebug();
  }
});

debugModeEl?.addEventListener("change", async () => {
  await chrome.storage.sync.set({ [DEBUG_KEY]: debugModeEl.checked });
  void refreshDebug();
});

blockInputEl?.addEventListener("change", async () => {
  await chrome.storage.sync.set({ [BLOCK_INPUT_KEY]: blockInputEl.checked });
});

exportBtn?.addEventListener("click", async () => {
  const data = await chrome.storage.local.get(["recentReceipts"]);
  const list = data.recentReceipts ?? [];
  const blob = new Blob([JSON.stringify(list, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sweeps-relief-receipts-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});
