"""Plaintext DNS denylist (one domain per line) for NextDNS / Pi-hole style imports."""

from __future__ import annotations

from sweeps_relief.policy.models import PolicyContent


def export_dns_denylist(content: PolicyContent) -> str:
    lines = ["# Sweeps_Relief DNS denylist", f"# policy version {content.version}", ""]
    all_hosts = sorted(set(content.domains) | set(content.funnel_domains) | set(content.affiliate_domains))
    for h in all_hosts:
        lines.append(h)
    lines.append("")
    return "\n".join(lines)
