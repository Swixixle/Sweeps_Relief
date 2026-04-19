"""Deterministic JSON serialization for signing and hashing."""

from __future__ import annotations

import json
from typing import Any


def canonicalize_json(obj: Any) -> bytes:
    """
    Serialize to canonical UTF-8 bytes: sorted keys at every object level,
    no insignificant whitespace, UTF-8 (non-ASCII preserved).
    """
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
