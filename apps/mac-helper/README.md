# Sweeps_Relief mac-helper (v1)

Native macOS helper: **fetch signed `policy.json` → verify Ed25519 + SHA-256 → render hosts-style blocklist → write managed file → JSONL event chain → optional LaunchAgent.**

This is **not** a Network Extension and **not** automatic system `/etc/hosts` modification in v1. It implements the real control loop; merging into `/etc/hosts` or other privileged paths is intentionally narrow and future work.

## Build

Requires Swift 5.10+ (SwiftPM). From this directory:

```bash
swift build -c release
```

Binary: `.build/release/SweepsReliefMacHelper`

## Configure

1. Copy `config.example.json` to e.g. `~/Library/Application Support/SweepsRelief/config.json` and edit paths.
2. Place the **same** `public.pem` used with Python `sweeps-relief verify-policy` at `public_key_path`.
3. Set `policy_url` to a reachable `policy.json`.

## Run once

```bash
.build/release/SweepsReliefMacHelper run-once --config /path/to/config.json
```

## Install LaunchAgent

Pass the **absolute** path to the built binary:

```bash
.build/release/SweepsReliefMacHelper install-launchagent \
  --config /path/to/config.json \
  --helper-path "$(pwd)/.build/release/SweepsReliefMacHelper"
```

Uninstall:

```bash
.build/release/SweepsReliefMacHelper uninstall-launchagent
```

## Other commands

| Command | Purpose |
|--------|---------|
| `render-hosts --config …` | Verify policy (from cache or fetch), print hosts to stdout |
| `check-tamper --config …` | Compare cache vs on-disk hosts + hash; exit 2 if drift |
| `print-state --config …` | Show applied hash, version, device id |
| `archive-event-log --config …` | Move `events.jsonl` aside (timestamped) to start a clean hash chain |

## Trust boundaries (do not regress)

1. **Python/Swift verifier parity** — The `PolicyParityTests` case `policyJsonHashMatchesArtifactField` must pass; it is run in CI on every `apps/mac-helper/**` change (`mac-helper` workflow). This is the main cross-language signing seam.
2. **No shared URL cache for policy** — `PolicyFetcher` uses an ephemeral session and ignores local cache. Reverting files on disk does not help if HTTP responses were cached; treating cache bypass as optional would reintroduce false `hashMismatch`.
3. **Ledger hygiene** — After a bad run or debugging session left bogus rows in `events.jsonl`, run `archive-event-log` before collecting evidence or screenshots so prior false failures do not pollute the chain.

## What v1 does

- Verifies canonical policy-body SHA-256 and **Ed25519** signature (same bytes as Python `policy_body_for_signing`).
- Renders deterministic `0.0.0.0` lines for `domains`, `funnel_domains`, and `affiliate_domains` plus `www.` variants.
- Writes managed `generated_hosts` and state files under `state_dir`.
- Append-only `events.jsonl` with chained hashes aligned with the repo’s Python `chain_event` shape.

## What v1 does not do

- No Network Extension; no browser instrumentation; no OCR.
- No automatic root-powered install—**dry-run to user-writable paths only**.

## Tests

```bash
swift test
```

Uses the `swift-testing` package when the host toolchain does not ship Swift Testing; you may see deprecation hints on Swift 6—safe to ignore or drop the package if you standardize on Swift 6 only.

CI runs the same tests on **macos-latest** (see `.github/workflows/mac-helper.yml`).

## Cross-check with Python

```bash
cd ../..   # repo root
sweeps-relief verify-policy data/published/policy.json --public-key keys/public.pem
```

Use the same keys and policy URL the helper consumes.
