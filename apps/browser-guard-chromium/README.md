# Chromium extension (Chrome, Brave, Edge, Arc)

MV3 extension built with **esbuild**. Output goes to `dist/` (gitignored).

## Build

From the repository root:

```bash
npm install
npm run build --workspace=@sweeps-relief/browser-guard-chromium
```

Build also emits `scripts/manual-harness.bundle.mjs` (gitignored) so `npm run harness` works with plain Node (no `tsx`).

Load **unpacked** in `chrome://extensions` → `apps/browser-guard-chromium/dist`.

## Behavior

- **Content script** captures `paste`, runs `@sweeps-relief/browser-guard-core` with bundled rules from `config/`, blocks when the engine returns `block_paste` or `redact_and_block`.
- **Background** stores block count and recent receipts in `chrome.storage.local`.
- **Popup** toggles guard + shows block count; **options** shows rule version, optional **debug snapshot** (last scores/terms/action), **block-input** toggle, and exports receipts JSON.

No network calls — rules are embedded at build time.

## Tonight’s checkpoint (engine + Chromium)

### 1. Prove the shared engine (no browser)

```bash
npm run harness --workspace=@sweeps-relief/browser-guard-chromium
```

This reads `fixtures/benign.html` and `fixtures/risky.html`, runs the same evaluation path as the extension, and prints actions plus one JSON receipt line per case. Expect **allow** on benign and **block** on risky for paste (`checkpoint-user@example.com`).

### 2. Prove the unpacked extension

```bash
npm run build --workspace=@sweeps-relief/browser-guard-chromium
```

Serve the fixtures over HTTP (extensions behave more predictably than `file://`):

```bash
cd apps/browser-guard-chromium/fixtures && python3 -m http.server 8765
```

Fixtures: `benign.html`, `risky.html`, `high_risk_cashier.html` (wallet / billing / KYC-style — should score higher than `risky.html`).

Load unpacked from `apps/browser-guard-chromium/dist`. Open `http://127.0.0.1:8765/benign.html`, paste `checkpoint-user@example.com` into the search field — paste should go through. Open `http://127.0.0.1:8765/risky.html` or `high_risk_cashier.html`, paste into the email field — paste should be blocked (often `redact_and_block` or `block_paste` depending on scores). Enable **Options → Local debugging** to store the last evaluation JSON. Popup block count increases; **Export receipts JSON** for blocked events.

Safari stays structure-only until you add an Xcode Web Extension target.
