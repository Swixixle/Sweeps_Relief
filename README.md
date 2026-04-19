# Sweeps_Relief

**Signed anti-sweeps enforcement and tamper-evident recovery infrastructure**

Sweeps_Relief is a recovery-first system for making sweepstakes gambling materially harder to access across Apple devices, while preserving cryptographic integrity, explicit trust boundaries, and signed evidence of relapse and bypass pressure.

This is not a generic blocker.
It is accountability infrastructure.

---

## Why this exists

Sweepstakes casino operators do not behave like a stable set of ordinary websites.

They rotate domains, spawn mirrors, lean on affiliate funnels, exploit review sites, use bonus mechanics as triggers, and rely on payment/onboarding paths that make relapse frictionless once contact is made.

Static domain blocking helps, but static domain blocking alone is not enough.

Sweeps_Relief exists to attack the entire access chain:

- the destination
- the funnel
- the deposit path
- the bypass attempt
- the invisibility of relapse pressure

---

## Core idea

A block should not be a silent failure.

If a user attempts to access a blocked sweeps site, search for one, navigate through an affiliate funnel, or tamper with the system, that should become a **signed event** in a verifiable ledger.

Sweeps_Relief treats refusal as signal.

---

## What this system does

Sweeps_Relief is designed to support:

- **signed block policy**
- **domain and funnel blocking**
- **heuristic sweeps-content detection**
- **payment-path detection in flagged contexts**
- **tamper-evident event logging**
- **optional co-signed override / trusted-person control**
- **periodic discovery of new sweeps domains**
- **exportable evidence and reporting artifacts**

The system is designed around one canonical, signed policy that multiple devices can consume.

---

## What this system is not

Sweeps_Relief is **not**:

- spyware
- a promise of absolute unbypassability
- a fake “AI addiction cure”
- a raw auto-complaint spam cannon
- a surveillance product for unrelated browsing
- an enterprise MDM platform

The project aims for serious friction, serious observability, and serious integrity.

Not magic.

---

## Design principles

### 1. Static lists are necessary but insufficient

A list of 260 domains is a starting point, not a complete defense.

### 2. The funnel matters as much as the operator

Review pages, promo pages, affiliate redirects, and bonus bait can be as important to block as the casino domain itself.

### 3. Policy must be verifiable

The machine should not apply unsigned or silently altered policy.

### 4. Relapse pressure should be visible

Repeated access attempts, search attempts, and tamper attempts should become signed events.

### 5. Override should be explicit

If the system is weakened, that change should be deliberate, logged, and preferably co-signed.

### 6. Recovery beats theater

Capability claims must match what macOS, iPhone, DNS, and local enforcement can actually do.

---

## Architecture overview

Sweeps_Relief is split into four major layers:

### 1. Control Plane

A canonical cloud-backed signed artifact source publishes:

- `policy.json`
- `policy.sig`
- `pubkey.json`
- `revocations.json`
- `heuristics.json`
- `funnel-blocklist.json`

A simple v1 approach is GitHub Releases plus signed JSON artifacts.

### 2. Policy Layer

The policy includes more than just domains.

It may contain:

- blocked operator domains
- blocked domain patterns
- funnel and affiliate domains
- heuristic keyword and page indicators
- payment/deposit path indicators
- provenance and source metadata
- signature metadata

### 3. Enforcement Layer

Each device consumes the same signed policy, verifies it locally, and applies enforcement using whatever mechanisms are actually available on that platform.

Planned targets:

- macOS
- iPhone / iOS
- filtered DNS / router integration later

### 4. Ledger / Reporting Layer

Blocked attempts, tamper attempts, policy failures, and override events are written into a tamper-evident event chain and exported as signed daily or weekly bundles.

---

## Threat model

### Primary threat

Compulsive gambling behavior under relapse pressure.

This includes:

- direct navigation to sweeps sites
- sweeps-related searches
- affiliate/review funnel entry
- payment/deposit progression
- attempts to disable or weaken protections

### Secondary threat

Operator churn and infrastructure mutation.

This includes:

- new domains
- promo mirrors
- affiliate redirects
- disguised payment paths
- content that evades simple domain matching

### Out of scope for absolute guarantees

Sweeps_Relief does not claim perfect control over:

- unmanaged third-party devices
- unrestricted admin access plus unlimited time/intent to dismantle every layer
- traffic that cannot legally or technically be inspected within platform limits

---

## Signed policy model

All production policy artifacts should be:

- canonically serialized
- hashed deterministically
- signed with Ed25519
- verified before local application

This creates a cryptographic ground truth for what the device is supposed to enforce.

Unsigned or modified policy should fail verification and produce an event.

---

## Refusal as signal

When a blocked site fails to load, that is not just a generic deny action.

It may become one or more signed events such as:

- `blocked_navigation`
- `blocked_search`
- `blocked_funnel_page`
- `blocked_payment_path`
- `tamper_attempt`
- `policy_verification_failed`
- `override_requested`
- `override_denied`
- `relapse_event`

This is one of the core concepts of the project:
**enforcement without observability is too easy to rationalize away.**

---

## Funnel blocking

Sweeps_Relief does not stop at operator domains.

It is designed to also handle:

- review sites
- “best sweeps casino” lists
- promo code aggregators
- affiliate landing pages
- daily-bonus bait pages
- deposit/onboarding gateways

The system should classify these separately instead of pretending every harmful page is the same kind of target.

---

## Heuristics

Static blocklists are incomplete by nature.

So the project also supports heuristic detection based on explainable combinations such as:

- `sweeps`
- `sweepstakes casino`
- `daily login bonus`
- `gold coins`
- `SC`
- `redeemable`
- `social casino`
- `play now`
- `free coins`

Heuristics should be conservative, testable, documented, and combination-based.

No black-box overblocking.

---

## Payment friction

In many cases, the meaningful danger threshold is not merely landing on a site, but reaching the deposit or cashier flow.

Sweeps_Relief is designed to model:

- payment processor domains
- cashier endpoints
- deposit flow pages
- KYC/onboarding checkpoints
- redemption flow patterns

This should be scoped tightly to flagged gambling contexts, not expanded into broad surveillance.

---

## Oracle mode

Sweeps_Relief supports a future model in which sensitive changes cannot be made unilaterally.

This trusted-person model may require a second signer for actions such as:

- removing blocked domains
- disabling enforcement
- lowering strictness
- approving override requests
- rotating keys
- revoking production policy

Oracle mode is not required for v1 setup, but the architecture is built to support it from the start.

See `docs/oracle-model.md`.

---

## Apple device reality

Sweeps_Relief is designed for an Apple stack, but Apple devices still enforce locally.

That means:

- one canonical signed policy can be shared
- Mac enforcement happens on the Mac
- iPhone enforcement happens on the iPhone
- router/DNS enforcement can later reinforce both

The system should aim for **set up once at the policy layer**, not pretend that one device can secretly control every other device without local configuration.

---

## What v1 should do

The first useful version should:

1. ingest seed domains and funnel sites
2. normalize and classify them
3. build a signed policy artifact
4. verify policy before use
5. export blocklists for practical enforcement layers
6. generate signed event records
7. generate signed daily/weekly summaries
8. support discovery of new candidates
9. scaffold Oracle/split-control approvals

---

## Repo structure

```text
Sweeps_Relief/
  README.md
  docs/
    architecture.md
    threat-model.md
    crypto-verification.md
    apple-platform-plan.md
    oracle-model.md
    enforcement-matrix.md
    funnel-intelligence.md
    discovery-pipeline.md
    reporting.md
  data/
    raw/
    normalized/
    published/
    heuristics/
    candidates/
    samples/
  packages/
    core/
    signer/
    policy/
    logger/
    reports/
    discovery/
    exports/
    heuristics/
    approvals/
  apps/
    cli/
    mac-helper/
    ios-companion/
  tests/
    fixtures/
    unit/
    integration/
```

---

## First implementation priorities

- canonical policy schema
- deterministic JSON canonicalization
- SHA-256 hashing
- Ed25519 signing and verification
- domain/funnel normalization pipeline
- export formats for practical enforcement
- event-chain hashing
- signed report bundles
- Oracle approval scaffold
- clear platform capability docs

---

## Capability honesty

This project should never claim more than it can enforce.

It should explicitly document:

- what macOS can enforce
- what iPhone can enforce
- what filtered DNS adds
- what requires router/admin control
- what remains bypassable in principle
- what is detected versus prevented

False omnipotence is part of the problem this project is trying to solve.

---

## Roadmap

### Phase 1

- signed policy
- seed import
- normalization
- exports
- event ledger
- reports
- docs

### Phase 2

- discovery pipeline
- candidate promotion flow
- funnel intelligence expansion
- payment-path refinement
- Mac helper hardening

### Phase 3

- iPhone companion integration
- Oracle co-sign workflow
- filtered DNS / router support
- formal evidence pack generation

---

## Project stance

This project is anti-predatory-system, but it should remain technically disciplined.

It is acceptable for the repo to be morally clear.
It is not acceptable for the repo to be sloppy about capability.

---

## Status

Bootstrap / architecture phase.
