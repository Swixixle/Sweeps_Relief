from sweeps_relief.core.canonical_json import canonicalize_json
from sweeps_relief.core.chain import chain_event
from sweeps_relief.core.hashing import hash_hex


def test_canonical_json_stable():
    a = {"z": 1, "a": {"b": 2, "c": 3}}
    b = {"a": {"c": 3, "b": 2}, "z": 1}
    assert canonicalize_json(a) == canonicalize_json(b)


def test_chain_deterministic():
    h1 = chain_event(None, {"t": "blocked_navigation", "x": 1})
    h2 = chain_event(None, {"t": "blocked_navigation", "x": 1})
    assert h1 == h2
    h3 = chain_event(h1, {"t": "relapse_event"})
    assert h3 != h1


def test_hash_hex():
    assert len(hash_hex(b"test")) == 64
