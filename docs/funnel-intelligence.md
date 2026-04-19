# Funnel intelligence

## Why

Operators are not the only entry point. Review sites, “best sweeps” aggregators, promo hubs, and affiliate redirects recreate the funnel even when a single casino domain is blocked.

## Artifact

- `funnel-blocklist.json` (see `FunnelBlocklist` in code): entries carry a **classification**:

  - `operator`, `affiliate`, `review`, `promo`, `payment`, `unknown`, `suspected`.

## Relationship to core policy

- Core `PolicyContent` includes `funnel_domains` and `affiliate_domains` for device exports.
- A richer funnel file can evolve independently with its own version and signing strategy.

## v1 limits

- No screen-scraping across the open web by default.
- Discovery seeds should be **curated** (RSS, known lists, manual imports), then normalized and classified.
