"""Canonical JSON per SIGNING.md spec. Deliberately distinct from core.canonical_json
because the spec requires ensure_ascii=True; Relief's internal canonicalizer uses
ensure_ascii=False. Do not unify without migrating all of Relief onto the spec."""

import json
from typing import Any


def canonical_payload_bytes(payload: dict[str, Any]) -> bytes:
    return json.dumps(
        payload,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=True,
    ).encode("utf-8")
