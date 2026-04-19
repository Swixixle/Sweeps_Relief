"""Candidate discovery diff and signed candidate artifact (no auto-promote)."""

from __future__ import annotations

import base64
from datetime import datetime, timezone
from typing import Any

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from sweeps_relief.core.canonical_json import canonicalize_json
from sweeps_relief.core.hashing import hash_hex
from sweeps_relief.signer.ed25519 import sign_bytes


def diff_domains(current: list[str], candidates: list[str]) -> dict[str, list[str]]:
    cur = set(x.strip().lower() for x in current)
    cand = set(x.strip().lower() for x in candidates)
    return {
        "added": sorted(cand - cur),
        "removed": sorted(cur - cand),
        "unchanged_count": len(cur & cand),
    }


def build_candidate_artifact(
    *,
    version: str,
    added: list[str],
    removed: list[str],
    source: str,
    private_key: Ed25519PrivateKey | None = None,
) -> dict[str, Any]:
    """
    Signed candidate set for human/oracle review before promotion to production policy.
    If private_key is None, hash is still computed but signature is empty.
    """
    body = {
        "schema_version": "1.0",
        "version": version,
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "source": source,
        "added": sorted(set(added)),
        "removed": sorted(set(removed)),
    }
    canon = canonicalize_json(body)
    digest = hash_hex(canon)
    out = dict(body)
    out["hash"] = digest
    out["signing_scheme"] = "ed25519"
    out["signature_b64"] = ""
    if private_key is not None:
        sig = sign_bytes(private_key, canon)
        out["signature_b64"] = base64.b64encode(sig).decode("ascii")
    return out
