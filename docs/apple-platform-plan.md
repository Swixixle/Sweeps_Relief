# Apple platform plan

## Shared story

- **One canonical signed policy** (e.g. GitHub Releases or equivalent).
- **Each device** fetches, verifies, and applies enforcement **locally**.
- Same keys and evidence model; **capabilities differ** by platform.

## macOS (strongest first target)

v1 repo support:

- `hosts` export, DNS denylist export, browser rules JSON.
- Documentation for Screen Time companion workflows.
- Scaffold for a future local helper: sync, logging, tamper signals.

Future: native helper, richer tamper detection, cooldown UX—all without claiming silent cross-device control.

## iOS / iPhone

v1 repo support:

- Signed policy sync **model** (same artifacts).
- Documentation for Screen Time, filtered DNS (e.g. NextDNS), and organizational constraints where applicable.
- Optional companion app scaffold **only** when it adds clear value; no fantasy of Mac silently enforcing phone browsing.

## Reality check

- **No** claim that one Mac app silently enforces all browsing on an iPhone.
- **Yes** to “set up once at the policy layer”: one verified policy stream; per-device enforcement.
