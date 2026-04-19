"""SHA-256 helpers for artifact and chain digests."""

from __future__ import annotations

import hashlib


def hash_bytes(data: bytes) -> bytes:
    return hashlib.sha256(data).digest()


def hash_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()
