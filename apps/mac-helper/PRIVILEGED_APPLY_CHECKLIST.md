# Privileged apply — pass/fail runbook

Use on a **non-production Mac** or disposable account until you are confident in your build, signing, and helpers.

Prereqs: `apps/mac-helper` built; you have a writable dry-run config and **`VALIDATION_CHECKLIST.md`** complete for policy fetch, verify, dry-run, and drift/tamper cases.

The privileged helper writes only the **SweepsRelief managed section** in `/etc/hosts`, delimited by:

- `# BEGIN SWEEPS_RELIEF_MANAGED`
- `# END SWEEPS_RELIEF_MANAGED`

All other lines are preserved on merge (see `PrivilegedEtcHostsMerge`).

---

## P/F matrix

| Step | What to verify | P/F |
|------|----------------|-----|
| A.1 | Helper **not** installed / XPC unavailable: `run-once` with `apply_mode` that uses privileged fallback still completes (fallback to managed file path or clear failure per config) | |
| A.2 | **Digest mismatch**: tamper managed payload so SHA-256 no longer matches; privileged path refuses before writing (client + helper digest checks) | |
| A.3 | **Invalid hosts content** (fails `PrivilegedHostsLineValidation`): request is refused; `/etc/hosts` unchanged from pre-request backup | |
| A.4 | **Orphan markers**: hand-edit `/etc/hosts` to have only `BEGIN` or only `END`; apply refuses with an explicit marker error; file restored from backup if a write was attempted | |
| A.5 | **Successful privileged write**: valid policy, helper running, markers absent or well-formed → managed section updates; user lines outside the block unchanged | |
| A.6 | **Re-run, same policy**: no spurious drift; managed section idempotent | |
| A.7 | **Reassert after user edit inside managed block** (optional): user edits between markers; next good apply replaces only the managed block; lines **outside** markers still preserved | |
| A.8 | **End-to-end XPC** (manual if no automated test): install helper per your shipping process; confirm `ping`, `version`, and one successful merge with backup created under `/var/db/sweepsrelief/backups/` | |

---

## Notes

- Keep a **pre-test copy** of `/etc/hosts` so you can revert without relying on helper restore alone.
- Do not use **`chmod 4755`** or ad-hoc root copies on a primary machine; use the supported install path when you have signed binaries and SMJobBless (or equivalent) in place.
- Automated `swift test` covers merge, digest, and validation logic; it does **not** replace steps A.x on real hardware.
