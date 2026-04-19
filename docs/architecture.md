# Architecture

Sweeps_Relief separates **policy definition**, **verification**, **local enforcement surfaces**, and **evidence export**.

## Control plane

- **Source of truth**: versioned artifacts (e.g. Git repository + signed JSON + releases).
- **Artifacts**: `policy.json` (signed body), `pubkey.json`, optional `funnel-blocklist.json`, `revocations.json`, discovery **candidate** bundles.
- **Flow**: fetch → verify signature and hash → apply locally → log structured events → export signed summaries when needed.

## Policy model

Policy is more than a domain list. It includes:

- Blocked domains and optional domain patterns.
- Funnel and affiliate domains.
- Heuristic keywords and page/title indicators (weighted, testable).
- Payment-path indicators (cashier, deposit, checkout) for friction logging—not full traffic inspection.

Canonical serialization uses **sorted keys** and stable list ordering where applicable so hashes are reproducible.

## Enforcement surfaces (per device)

Each device consumes the **same** verified policy; enforcement differs by OS capabilities:

- **macOS**: hosts file, DNS denylists, browser rules JSON, future helper for sync and tamper-aware logs.
- **iOS**: Screen Time and filtered DNS documentation; same policy sync story; no claim that Mac silently enforces on iPhone.
- **Router / DNS**: shared denylist at the network layer when a trusted person controls DNS admin.

## Event ledger

Events use hash chaining for tamper-evidence: each record links to a previous hash; bundles sign a digest of ordered events. This supports accountability without mandating who receives notifications.

## Discovery

Automated discovery produces **normalized, classified candidates** and a **signed candidate artifact**. Promotion to production policy is a **separate** step: review, optional Oracle co-sign, then publish.

## Non-goals (v1)

- No spyware; no OCR across all browsing.
- No auto-promotion of discovery output to production policy.
- No default third-party email blasting on every event.
