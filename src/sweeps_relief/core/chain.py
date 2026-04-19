"""Append-only style hash chaining for events."""

from __future__ import annotations

from typing import Any

from sweeps_relief.core.canonical_json import canonicalize_json
from sweeps_relief.core.hashing import hash_hex


def chain_event(prev_hash: str | None, event: dict[str, Any]) -> str:
    """
    Compute the next chain hash from the previous hash and a canonicalized event.
    Use empty string or a genesis constant for the first event's prev_hash.
    """
    payload = {
        "prev_hash": prev_hash or "",
        "event": event,
    }
    return hash_hex(canonicalize_json(payload))
