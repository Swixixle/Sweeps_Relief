"""hosts-style 127.0.0.1 blocklist export."""

from __future__ import annotations

from sweeps_relief.policy.models import PolicyContent


def export_hosts_file(content: PolicyContent, loopback: str = "127.0.0.1") -> str:
    lines = ["# Sweeps_Relief hosts export", f"# policy version {content.version}", ""]
    all_hosts = sorted(set(content.domains) | set(content.funnel_domains) | set(content.affiliate_domains))
    for h in all_hosts:
        lines.append(f"{loopback}\t{h}")
    lines.append("")
    return "\n".join(lines)
