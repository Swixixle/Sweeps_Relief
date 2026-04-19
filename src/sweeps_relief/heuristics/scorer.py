"""
Conservative sweeps-related text scoring: combinations / weights, not single-word blocks.

All rules are transparent and unit-testable; callers should set thresholds explicitly.
"""

from __future__ import annotations

import re
from typing import Any

from sweeps_relief.policy.models import HeuristicsBlock

# Default multi-token boosts (documented, testable)
_COMBO_PATTERNS: list[tuple[str, float, str]] = [
    (r"sweepstakes\s+casino", 2.5, "combo:sweepstakes_casino"),
    (r"gold\s+coins?", 1.5, "combo:gold_coins"),
    (r"daily\s+login\s+bonus", 2.0, "combo:daily_login_bonus"),
    (r"social\s+casino", 2.0, "combo:social_casino"),
    (r"redeem\s+(winnings|prize)", 1.5, "combo:redeem"),
]


def score_text(text: str, heuristics: HeuristicsBlock) -> tuple[float, list[str]]:
    t = text.lower()
    score = 0.0
    reasons: list[str] = []
    for kw in heuristics.keywords:
        if kw.lower() in t:
            w = heuristics.keyword_weights.get(kw, 1.0)
            score += w
            reasons.append(f"keyword:{kw}")
    for pat, boost, rid in _COMBO_PATTERNS:
        if re.search(pat, t):
            score += boost
            reasons.append(rid)
    for ind in heuristics.page_indicators:
        if ind.lower() in t:
            score += 1.0
            reasons.append(f"page:{ind}")
    for ind in heuristics.title_indicators:
        if ind.lower() in t:
            score += 1.0
            reasons.append(f"title:{ind}")
    return score, sorted(set(reasons))


def explain_match(
    text: str,
    heuristics: HeuristicsBlock,
    threshold: float = 3.0,
) -> dict[str, Any]:
    score, reasons = score_text(text, heuristics)
    return {
        "score": score,
        "matched": score >= threshold,
        "threshold": threshold,
        "reasons": reasons,
    }
