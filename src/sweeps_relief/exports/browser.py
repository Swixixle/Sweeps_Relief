"""Generic browser-oriented JSON rules export (consumer-specific mapping later)."""

from __future__ import annotations

import json
from typing import Any

from sweeps_relief.policy.models import PolicyContent


def export_browser_rules_json(content: PolicyContent) -> str:
    rules: dict[str, Any] = {
        "schema_version": "1.0",
        "policy_version": content.version,
        "block_domains": sorted(
            set(content.domains) | set(content.funnel_domains) | set(content.affiliate_domains)
        ),
        "domain_patterns": list(content.domain_patterns),
        "notes": "Map this file to your browser extension or enterprise policy as supported.",
    }
    return json.dumps(rules, indent=2, sort_keys=True) + "\n"
