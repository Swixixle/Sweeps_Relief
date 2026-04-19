# Cryptographic verification

## Canonical JSON

- UTF-8 bytes from `json.dumps(..., sort_keys=True, separators=(",", ":"), ensure_ascii=False)`.
- Nested objects sort recursively via JSON serialization.

## Hashing

- **SHA-256** hex digest over canonical artifact bytes unless otherwise noted.

## Ed25519

- Signing keys are **Ed25519** (via the `cryptography` library).
- `pubkey.json` holds a base64-encoded raw public key and scheme label.

## Policy artifact

1. Build `PolicyContent` and serialize to canonical bytes (**excluding** outer `hash` / `signature_b64`).
2. `hash = SHA256(canonical_bytes)` (hex).
3. `signature = Ed25519_sign(private_key, canonical_bytes)`.
4. Consumers recompute hash, verify signature, then apply policy.

## Event chain

- `chain_event(prev_hash, event_dict)` hashes `{"prev_hash": ..., "event": ...}` canonically.
- Event signing (when enabled) signs `{"event": body, "hash"}` after the hash is fixed.

## Log bundles

- `events_hash = SHA256(canonical_json(events))`.
- Bundle signature covers `bundle_id`, period bounds, `device_id`, and `events_hash`.

## CLI

- `sweeps-relief gen-keys` — local key generation.
- `sweeps-relief sign-policy` / `verify-policy` — policy round-trip.
- Candidate artifacts use the same canonical + sign pattern when a key is supplied.
