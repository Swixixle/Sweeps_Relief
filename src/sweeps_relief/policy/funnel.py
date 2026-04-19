"""Funnel intelligence list (separate artifact from core policy)."""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, field_validator


class FunnelClassification(str, Enum):
    OPERATOR = "operator"
    AFFILIATE = "affiliate"
    REVIEW = "review"
    PROMO = "promo"
    PAYMENT = "payment"
    UNKNOWN = "unknown"
    SUSPECTED = "suspected"


class FunnelEntry(BaseModel):
    domain: str
    classification: FunnelClassification
    notes: str | None = None
    sources: list[str] = Field(default_factory=list)

    @field_validator("domain")
    @classmethod
    def normalize_domain(cls, v: str) -> str:
        return v.strip().lower()


class FunnelBlocklist(BaseModel):
    schema_version: str = "1.0"
    version: str
    entries: list[FunnelEntry] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
