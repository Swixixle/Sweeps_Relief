# Trust store (Relief)

`trust_store.json` at the **Sweeps_Relief** repo root lists Ed25519 **public** keys Relief trusts to verify artifacts **published by Sweeps_Intel** (`intel_snapshot`, blocklist / `intel_block_candidates`), per `docs/SIGNING.md` in Sweeps_Intel.

Intel signs its outputs with separate keypairs; private keys stay in Intel’s `keys/` (gitignored). Relief only needs **public** PEMs here so `verify_envelope` / `load_verified_*` can validate envelopes before consumption.

**Public keys only.** Never commit private keys.

## Operator workflow

### Add a new trusted Intel key

1. Obtain the public PEM from Intel (or from a key ceremony export).
2. Add a new object to the `keys` array following the SIGNING.md schema (`key_id`, `algorithm`, `public_key_pem`, `issued_at`, `authorized_for`, optional `revoked_at` / `revocation_reason`).
3. Set `updated_at` to the current UTC timestamp.
4. Commit with a message that states the key’s purpose (snapshot vs blocklist, rotation, etc.).

### Revoke a key

1. Set `revoked_at` to the UTC timestamp of revocation.
2. Set `revocation_reason` to a short human-readable string.
3. **Do not** delete the key entry — revocation stays auditable; deletion does not.

### Placeholders

Until end-to-end testing is wired, the repo may ship placeholder PEM strings. Replace them with real Intel public keys before relying on verification in production paths.
