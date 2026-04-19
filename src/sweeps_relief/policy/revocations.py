"""Revocation list for policy or signing keys (stub for v1)."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class RevocationEntry(BaseModel):
    target_id: str
    reason: str
    revoked_at: str


class RevocationsList(BaseModel):
    schema_version: str = "1.0"
    revocations: list[RevocationEntry] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
