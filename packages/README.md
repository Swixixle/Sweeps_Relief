# Packages layout

Implementation code lives under `src/sweeps_relief/` and is organized to mirror this conceptual layout:

- `core` — canonical JSON, SHA-256, hash chaining
- `signer` — Ed25519 helpers
- `policy` — schema, build/verify
- `logger` — event records and signed log bundles
- `exports` — hosts, DNS denylist, browser rules JSON
- `discovery` — normalization, candidate diff, signed candidate artifacts
- `heuristics` — conservative scoring helpers
- `approvals` — Oracle / split-control scaffold
- `reports` — Markdown summaries

The `packages/` directory holds this mapping only; Python packaging uses `src/sweeps_relief` via `pyproject.toml`.
