const countEl = document.getElementById("block-count");
const enabledEl = document.getElementById("enabled") as HTMLInputElement | null;

async function refresh(): Promise<void> {
  const local = await chrome.storage.local.get(["blockCount"]);
  const n = typeof local.blockCount === "number" ? local.blockCount : 0;
  if (countEl) countEl.textContent = String(n);
  const sync = await chrome.storage.sync.get(["guardEnabled"]);
  if (enabledEl) enabledEl.checked = sync.guardEnabled !== false;
}

void refresh();

enabledEl?.addEventListener("change", () => {
  void chrome.storage.sync.set({ guardEnabled: enabledEl.checked });
});

document.getElementById("open-options")?.addEventListener("click", () => {
  if (chrome.runtime.openOptionsPage) void chrome.runtime.openOptionsPage();
});
