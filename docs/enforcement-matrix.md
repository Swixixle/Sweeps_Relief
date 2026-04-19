# Enforcement matrix

| Layer | What it blocks / signals | Typical bypass | Notes |
|-------|---------------------------|----------------|-------|
| Hosts file | Listed domains to loopback | Edit hosts, use VPN, different browser profile | Strong for static lists; needs policy refresh |
| Local DNS list (device) | Same as hosts in many setups | Change DNS servers | Pair with DNS admin by trusted person |
| Filtered DNS (NextDNS, etc.) | Network-wide denylist | Other network, cellular without profile | Document password-held DNS where possible |
| Browser rules JSON | Extension or managed policy | Unmanaged browser | Export is generic; map to your stack |
| Screen Time / iOS restrictions | OS-level limits | PIN compromise, other devices | Oracle-held PIN increases friction |
| Heuristics | Signals on matched text/context | Novel wording | Conservative scoring; tests for FPs |

## Detection vs blocking

- **Blocking** applies where the OS or network allows a hard deny.
- **Detection / logging** applies where only partial visibility exists; events are still meaningful for accountability.

## Documentation expectation

Every release should state **what was enforced**, **where**, and **known limits**—no fake completeness.
