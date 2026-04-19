# Oracle Model

## Purpose

The Oracle Model defines how Sweeps_Relief can require a trusted second party for high-risk changes.

Its purpose is simple:

A recovery system is weaker when the same person under relapse pressure can instantly dismantle it.

The Oracle Model introduces controlled asymmetry into the trust boundary.

---

## Core idea

Some actions should not be unilaterally available to the protected user during a craving spike.

Examples:

- removing domains from the blocklist
- disabling enforcement
- lowering heuristic strictness
- rotating production signing keys
- revoking a current policy
- approving an override request
- changing filtered DNS control
- turning off reporting or tamper logging

The Oracle Model creates a mechanism where those actions require a second signer.

---

## Why “Oracle”

The term “Oracle” is used here to mean:

- a trusted external approver
- a holder of a control key or approval key
- a witness to high-risk policy changes
- a structural interruption to impulsive override

This is not mystical language in the implementation.
It is a role.

---

## Design goals

The Oracle Model should:

- increase friction on self-sabotaging actions
- preserve explicit trust boundaries
- create verifiable approval records
- support solo mode when no Oracle exists yet
- support split-control later without architectural rewrite
- fail loudly when approval is missing or invalid

The Oracle Model should **not**:

- infantilize the protected user
- become indistinguishable from spyware or coercive control
- hide who approved what
- make ordinary low-risk updates unnecessarily painful

---

## Modes of operation

Sweeps_Relief should support three modes.

### 1. Solo Mode

All signing keys and approvals remain local to the user.

Benefits:

- easiest setup
- minimal coordination
- useful for development and early deployment

Weakness:

- weakest resistance against impulsive disablement

Solo mode should still keep signed policy and signed event logs.
It simply does not require a second signer.

---

### 2. Oracle Mode

A trusted person holds an approval key for designated high-risk actions.

Typical pattern:

- user requests override or weakening change
- Oracle reviews request
- Oracle signs approval artifact
- system verifies approval
- change is permitted only if approval is valid and current

Benefits:

- much stronger against impulsive relapse-driven sabotage
- preserves review and intentionality
- creates durable approval evidence

Weakness:

- depends on a real trusted person
- requires operational coordination

---

### 3. Split-Control Mode

The strongest model.

Certain actions require multiple valid signatures, such as:

- user signature + Oracle signature
- operator key + Oracle key
- 2-of-2 or 2-of-3 threshold model

This mode is preferred for:

- disabling production enforcement
- revoking trusted public keys
- lowering strictness below a defined floor
- approving emergency overrides
- permanently removing major blocked categories

Benefits:

- strongest trust separation
- best match for recovery-critical controls
- best fit for “family” trust infrastructure

Weakness:

- more complex UX
- more key management burden

---

## Approval classes

Not every action should require Oracle approval.

Sweeps_Relief should define approval classes.

### Low-risk actions

Can be allowed without Oracle approval:

- refreshing the same policy version
- adding newly discovered blocked domains
- regenerating reports
- verifying artifacts
- rotating local log-bundle signing keys if policy permits

### Medium-risk actions

May require configurable Oracle approval:

- suppressing certain report outputs
- changing heuristic thresholds
- pausing discovery
- changing notification targets

### High-risk actions

Should strongly default to Oracle or split-control approval:

- disabling enforcement
- removing blocked domains
- lowering deny policy significantly
- disabling tamper logging
- changing root signing keys
- revoking production trust anchors
- approving a cooldown bypass

---

## Approval artifact model

Approval should be explicit and verifiable.

Example:

```json
{
  "change_id": "uuid-or-deterministic-id",
  "requested_at": "2026-04-19T00:00:00Z",
  "requested_by": "device-or-user-id",
  "action": "disable_enforcement",
  "reason": "human-entered justification",
  "policy_version": "2026.04.19.1",
  "approval_mode": "oracle",
  "signatures": [
    {
      "role": "user",
      "key_id": "user-key-1",
      "sig": "..."
    },
    {
      "role": "oracle",
      "key_id": "oracle-key-1",
      "sig": "..."
    }
  ]
}
```

Requirements:

- deterministic serialization
- stable action IDs
- signature verification before execution
- expiration support where appropriate
- optional nonce / replay protection

---

## Key roles

The model should distinguish keys by role.

Possible roles:

- **policy signing key**  
  Signs published policy artifacts.

- **oracle approval key**  
  Signs approval for high-risk changes.

- **user request key**  
  Signs user-originated requests or acknowledgments.

- **log bundle signing key**  
  Signs exported event and report bundles.

- **revocation key**  
  Used for emergency trust changes.

Keys should not be treated as interchangeable.

---

## Trust boundaries

The Oracle Model is only meaningful if trust boundaries are explicit.

Questions the system should answer:

- Who can publish production policy?
- Who can approve disabling enforcement?
- Who can revoke keys?
- Who can lower strictness?
- Who can rotate the Oracle key?
- What happens if the Oracle disappears?
- What happens if a key is lost or compromised?

These questions should be answered in documentation and, where possible, in code.

---

## Fail-closed vs fail-open

For high-risk actions, Sweeps_Relief should generally prefer **fail-closed** behavior.

That means:

- no valid Oracle approval → no dangerous change
- signature mismatch → deny
- expired approval artifact → deny
- unknown signing key → deny
- tampered approval payload → deny and log

For non-critical convenience features, fail-open may sometimes be acceptable, but the system should be explicit about when that is allowed.

---

## Override requests

An override should not be equivalent to silently disabling the system.

A proper override flow looks like:

1. user requests override
2. request becomes a signed event
3. request is stored in the ledger
4. Oracle reviews it
5. Oracle either signs approval or rejects it
6. system records approval or denial
7. enforcement changes only if approval verifies

Useful event types:

- `override_requested`
- `override_approved`
- `override_denied`
- `override_expired`

This matters because recovery systems fail when overrides are invisible.

---

## Cooldown-aware approvals

A future hardening path is cooldown-aware approval.

Example:

- override request submitted now
- earliest valid approval window begins after 24 or 48 hours
- Oracle signature before that window is rejected
- approval artifact contains issue time and valid-after time

This helps prevent impulsive, same-hour dismantling.

Example fields:

```json
{
  "requested_at": "2026-04-19T01:00:00Z",
  "valid_after": "2026-04-21T01:00:00Z"
}
```

---

## Oracle rotation

Trusted people change. Relationships change. Keys get lost.

The model must support Oracle rotation without destroying the system.

Rotation requirements:

- old Oracle key can be revoked
- new Oracle key can be enrolled
- rotation itself may require split-control approval
- historical approvals remain verifiable against historical trust state

This implies the need for:

- trust snapshots
- revocation records
- key metadata with active windows

---

## Compromise and loss scenarios

### If the Oracle key is compromised

The system should:

- revoke the compromised key
- log a trust-boundary event
- require a new approval path
- preserve prior history as historical fact, not current authority

### If the Oracle becomes unavailable

Possible policies:

- temporary strict lock mode
- emergency fallback process
- time-delayed recovery path
- migration to new Oracle after defined proof/approval steps

This should be configurable, but never vague.

---

## Human factors

The Oracle Model is only useful if the chosen person is actually appropriate.

A good Oracle is:

- trustworthy
- stable
- reachable
- willing to say no
- not easily manipulated during a craving episode
- comfortable holding a recovery boundary

A poor Oracle is:

- conflict-avoidant
- intermittent
- impulsive
- overly technical but unreliable
- likely to surrender the key under pressure

The repo should document the role plainly.

---

## Minimal viable Oracle support in v1

The first version does not need a full polished UX.

It should at minimum support:

- role-specific keys
- signed approval artifacts
- approval verification
- action classification by risk
- deny-if-missing for selected actions
- event logging for request/approval/denial
- documentation of trust boundaries

That is enough to make the architecture real.

---

## Relationship to the rest of the system

The Oracle Model does not replace:

- signed policy
- device-side verification
- DNS filtering
- event chaining
- discovery and updates
- platform-specific enforcement

It hardens one specific failure mode:
**the relapse-driven desire to tear down the barrier from inside.**

---

## Practical recommendation

If no trusted person exists yet:

- build Solo Mode first
- scaffold Oracle Mode immediately
- classify high-risk actions from day one
- require as little rewrite as possible when Oracle Mode is activated later

If a trusted person does exist:

- use Oracle Mode for all high-risk actions
- keep root policy changes under split-control if possible
- separate approval keys from ordinary reporting keys

---

## Summary

The Oracle Model adds structural friction to the moments when willpower is least reliable.

Its function is not punishment.
Its function is boundary integrity.

In Sweeps_Relief, an Oracle is not a metaphorical flourish.
It is a defined control role in a trust system.
