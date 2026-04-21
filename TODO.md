# Scratch / follow-ups

- [ ] `tests/integration/test_cli_smoke.py::test_cli_gen_sign_verify` fails with exit 1 on `gen-keys`; likely editable install issue, not related to except-sweep. Investigate after sweep complete.

## Signing architecture

- [ ] **Option C migration — unify Relief on SIGNING.md envelope format**
      Relief currently has two signing paradigms living side by side:
      1. Internal: flat artifacts (PolicyArtifact, LogBundle) with standard
         base64 and `ensure_ascii=False` canonicalization
      2. External (new, this commit): SIGNING.md envelope with base64url
         and `ensure_ascii=True` for verifying Intel's signed outputs
      The dual-paradigm is intentional scope-containment for the cross-repo
      signing integration project. Eventual migration to a single format
      (SIGNING.md envelope everywhere) is tracked here. Scope: policy.json,
      log bundles, event records, candidate artifacts, CLI verify commands,
      and downstream tooling that consumes Relief's signed files.
- [ ] Signed Intel exports are not yet enforced in any Relief CLI consumer
      path — verifier exists, ingest needs to be wired in when blocklist
      consumption is built out.
