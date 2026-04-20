# Safari wrapper (macOS first, iOS later)

This folder holds the **Safari bridge** and a **Web Extension placeholder** so the same shared stack as Chromium can be wired without duplicating risk logic.

## Layers

| Layer | Role |
|--------|------|
| **Web Extension** | Reuse `evaluatePasteDefense`, rules JSON, and receipt messages (same manifest shape as MV3 where Safari allows). |
| **Safari bridge** | Native shell: `SFSafariApplication`, permission prompts, optional `WKWebView` hosts later. |
| **Shared packages** | `@sweeps-relief/shared-risk-engine`, `@sweeps-relief/shared-receipts` (browser-safe exports only). |

## Follow-on work

1. Create an Xcode **App Extension** target with **Safari Web Extension**.
2. Point the extension’s resources at a built bundle (copy from `apps/browser-guard-chromium/dist` or a shared `npm run build:extension` output).
3. Implement `SafariBridge.swift` for activation / version display; keep paste evaluation in the extension JavaScript context.

## No network

The extension must continue to use **bundled JSON** from `config/` at build time, same as Chromium.
