# Threat model

## Primary threats

- Compulsive gambling behavior under **relapse pressure**.
- **Impulsive** search, browse, deposit, or bypass attempts.
- **Adversarial churn**: new domains, affiliate funnels, disguised payment flows.

## Secondary threats

- User disables local protections during a craving spike.
- User changes DNS or removes hosts/rules.
- Operators shift to mirror, promo, or review domains not yet listed.

## In scope for the design

- Signed policy distribution and verification.
- Layered blocking: destination, funnel, heuristic signals, payment-stage indicators (within supported contexts).
- Tamper-evident **signals** when protections are bypassed or policy fails verification.

## Out of scope for absolute guarantees

- Physically separate **unmanaged** devices.
- Unrestricted admin with **unlimited time** and intent to dismantle all layers.
- Decrypting or inspecting arbitrary encrypted traffic beyond what the OS content-filtering APIs allow.

## Honesty

The system documents **what each layer can enforce**, what it can **detect**, and which bypasses remain theoretically possible. Security theater is avoided.
