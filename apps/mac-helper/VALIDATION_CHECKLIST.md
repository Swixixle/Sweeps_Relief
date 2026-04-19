# Mac enforcement loop — validation checklist

Run in order. Mark **P** (pass) or **F** (fail) in the right column.

Prereqs: repo root = `Sweeps_Relief`, Python venv optional, Xcode/Swift 5.10+ for `apps/mac-helper`.

---

## 0. One-time paths (fill in before you start)

| Item | Your path |
|------|-----------|
| Repo root | `___________________________` |
| mac-helper config JSON | `___________________________` |
| State dir (writable) | `___________________________` |

---

## 1. Python: build & verify signed policy

| Step | Command | P/F |
|------|---------|-----|
| 1.1 | `cd Sweeps_Relief` | |
| 1.2 | `pip install -e ".[dev]"` | |
| 1.3 | `sweeps-relief gen-keys --out ./keys` | |
| 1.4 | `sweeps-relief build-policy --domains-file data/normalized/example.txt --version 0.1.0 --out data/published/policy.content.json` | |
| 1.5 | `sweeps-relief sign-policy data/published/policy.content.json --private-key keys/private.pem --out data/published/policy.json` | |
| 1.6 | `sweeps-relief verify-policy data/published/policy.json --public-key keys/public.pem` | |

**Expected:** Step 1.6 prints `OK: policy signature and hash match.`

---

## 2. Serve policy locally

| Step | Command | P/F |
|------|---------|-----|
| 2.1 | `cd data/published` (from repo root) | |
| 2.2 | `python3 -m http.server 8000` (leave running in a terminal) | |

**Expected:** `http://127.0.0.1:8000/policy.json` returns JSON in a browser or `curl`.

---

## 3. mac-helper config

Copy `validation-test/config.example.json` to `validation-test/config.json`, replace `REPO_ROOT` with your absolute repo path, then point `--config` at that file. Paths must be absolute. Example fields:

- `policy_url`: `http://127.0.0.1:8000/policy.json`
- `public_key_path`: absolute path to `keys/public.pem`
- `state_dir`, `hosts_output_path`, `applied_hash_path`, `event_log_path`: all writable, same tree

| Step | Check | P/F |
|------|--------|-----|
| 3.1 | Paths exist and are user-writable | |

---

## 4. Build & run helper (first run)

| Step | Command | P/F |
|------|---------|-----|
| 4.1 | `cd apps/mac-helper` | |
| 4.2 | `swift build -c release` | |
| 4.3 | `.build/release/SweepsReliefMacHelper run-once --config /path/to/config.json` | |

### First-run expectations (verify each)

| Check | P/F |
|-------|-----|
| `generated_hosts` (or your `hosts_output_path`) exists | |
| Contains expected domains from policy (e.g. `example-operator.test`, …) | |
| `applied_policy_hash.txt` exists | |
| `applied_policy_version.txt` exists | |
| `events.jsonl` has entries ending with a line whose `event_type` is `policy_update_applied` | |

---

## 5. Second run (no policy change)

| Step | Command | P/F |
|------|---------|-----|
| 5.1 | `.build/release/SweepsReliefMacHelper run-once --config /path/to/config.json` | |

### Second-run expectations

| Check | P/F |
|-------|-----|
| `applied_policy_hash.txt` unchanged (same bytes as after run 1) | |
| `applied_policy_version.txt` unchanged | |
| `events.jsonl` includes a `policy_unchanged` event (or equivalent no-op) | |
| No spurious `tamper_detected` / `drift_detected` when files are untouched | |

---

## 6. Failure tests

### A. Signature / hash failure (tampered policy)

| Step | Action | P/F |
|------|--------|-----|
| A.1 | Stop HTTP server; edit `data/published/policy.json` (e.g. change one character in a domain string) **without** re-signing | |
| A.2 | Restart `python3 -m http.server 8000` in `data/published` | |
| A.3 | `run-once` again | |

**Expected:** Verification fails; managed hosts not updated to match bad policy; `events.jsonl` contains `policy_verification_failed`.

Restore `policy.json` from git or re-run section 1 before continuing.

---

### B. Drift detection (edited hosts file)

| Step | Action | P/F |
|------|--------|-----|
| B.1 | After a **good** signed policy is served again, run `run-once` successfully | |
| B.2 | Append a line to `generated_hosts` (e.g. `# drift-test`) | |
| B.3 | `.build/release/SweepsReliefMacHelper check-tamper --config /path/to/config.json` | |

**Expected:** Non-zero exit; `issues` includes drift/tamper; `events.jsonl` records `drift_detected` or `tamper_detected` on the next `run-once` if you run it (see `Runner` behavior).

---

### C. Applied-hash mismatch / bad state

| Step | Action | P/F |
|------|--------|-----|
| C.1 | Replace `applied_policy_hash.txt` with **wrong hex** (not empty), or delete it | |
| C.2 | `run-once` with **unchanged** signed policy | |

**Expected:** No silent success: either the helper **re-applies** and overwrites hash (recovery) or logs inconsistency — note which. **Deleting** the hash file often triggers a **full re-apply** (same policy) rather than a tamper line; **wrong hash** while hosts still match last good render is the sharper drift case — use `check-tamper` after corrupting only the hash file to see `applied_hash_mismatch` in issues.

---

### D. Policy update path

| Step | Action | P/F |
|------|--------|-----|
| D.1 | Add a domain to `data/normalized/example.txt`, rebuild & sign | |
| D.2 | `sweeps-relief verify-policy data/published/policy.json --public-key keys/public.pem` → OK | |
| D.3 | `run-once` again | |

**Expected:** New domain in `generated_hosts`; new `applied_policy_hash.txt` / version; `policy_update_applied` in log.

---

## 6.5 Ledger hygiene (after false runs or tooling fixes)

If `events.jsonl` contains **spurious** `policy_verification_failed` / `hashMismatch` lines from an older helper (e.g. URL cache or PEM parsing bugs), archive before new evidence:

| Step | Command | P/F |
|------|---------|-----|
| L.1 | `.build/release/SweepsReliefMacHelper archive-event-log --config /path/to/config.json` | |

**Expected:** Current `events.jsonl` is **renamed** to `events.jsonl.archive-<timestamp>` in the same directory. The next `run-once` starts a **new** chain (first event uses empty `prev_hash`). Does **not** delete history — archives it for segregation.

---

## 7. Technical inspection (manual)

| Question | Notes | P/F |
|----------|--------|-----|
| 7.1 Swift canonical bytes = Python `policy_body_for_signing`? | If 1.6 OK and Swift `run-once` OK with same key, **yes** | |
| 7.2 Hosts output deterministic? | Two `render-hosts` or two runs with same policy → identical file | |
| 7.3 Event chain intact? | Each line JSON has `hash`; `prev_hash` chains to previous line’s `hash` | |
| 7.4 Drift checks useful, not noisy? | Real edits flag; untouched runs don’t spam tamper | |

---

## 8. After all smoke tests pass (optional next work)

1. Narrow privileged apply path (still isolated).  
2. NextDNS / denylist export + docs.  
3. Wire approval artifacts into helper behavior.  
4. Small installer (paths, LaunchAgent, keys).

**Do not** prioritize: GUI, iPhone-first, NE, OCR, auto-email, doc polish.

---

## Summary row

| Phase | Result |
|-------|--------|
| Python sign/verify | P / F |
| First helper run | P / F |
| Second run (unchanged) | P / F |
| Failure A | P / F |
| Failure B | P / F |
| Failure C | P / F |
| Failure D | P / F |
