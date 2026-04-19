from sweeps_relief.heuristics.scorer import explain_match
from sweeps_relief.policy.models import HeuristicsBlock


def test_heuristic_conservative():
    h = HeuristicsBlock(
        keywords=["sweeps"],
        page_indicators=[],
        title_indicators=[],
    )
    low = explain_match("unrelated discussion about sweeping the floor", h, threshold=10.0)
    assert low["matched"] is False
    high = explain_match(
        "sweepstakes casino daily login bonus gold coins redeem winnings",
        h,
        threshold=3.0,
    )
    assert high["matched"] is True
    assert high["reasons"]
