"""Oracle / split-control approval scaffold (policy-level, minimal UX in v1)."""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class ApprovalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    DENIED = "denied"


class ApprovalSignature(BaseModel):
    signer_id: str
    signature_b64: str
    signed_at: str


class ApprovalArtifact(BaseModel):
    """
    Co-sign flow for high-risk changes (remove block, disable enforcement, etc.).
    `requires` = number of distinct valid signatures required (e.g. 2 for split-control).
    """

    schema_version: str = "1.0"
    change_id: str
    requested_by: str
    change_summary: str = ""
    requires: int = 1
    status: ApprovalStatus = ApprovalStatus.PENDING
    signatures: list[ApprovalSignature] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
