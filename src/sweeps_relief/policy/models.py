"""Canonical policy schema: domains, funnels, heuristics, payment indicators."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, field_validator


class SchemaVersion(str, Enum):
    V1 = "1.0"


class SourceProvenance(BaseModel):
    """Where a policy row or list came from."""

    name: str
    url: str | None = None
    retrieved_at: str | None = None


class HeuristicsBlock(BaseModel):
    """Keyword and page/title indicators with optional weights."""

    keywords: list[str] = Field(default_factory=list)
    page_indicators: list[str] = Field(default_factory=list)
    title_indicators: list[str] = Field(default_factory=list)
    # rule_id -> weight for scoring (conservative combinations in evaluator)
    keyword_weights: dict[str, float] = Field(default_factory=dict)


class PolicyContent(BaseModel):
    """Policy body signed by Ed25519; hash covers canonical form without hash/signature."""

    schema_version: str = Field(default=SchemaVersion.V1.value)
    version: str = Field(..., description="Semantic policy version for humans and devices.")
    generated_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    )
    domains: list[str] = Field(default_factory=list)
    domain_patterns: list[str] = Field(default_factory=list)
    funnel_domains: list[str] = Field(default_factory=list)
    affiliate_domains: list[str] = Field(default_factory=list)
    heuristics: HeuristicsBlock = Field(default_factory=HeuristicsBlock)
    payment_indicators: list[str] = Field(default_factory=list)
    sources: list[SourceProvenance] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("payment_indicators")
    @classmethod
    def sorted_unique_payment(cls, v: list[str]) -> list[str]:
        return sorted(set(p.strip().lower() for p in v if p.strip()))

    @field_validator("domains", "funnel_domains", "affiliate_domains")
    @classmethod
    def sorted_unique_domains(cls, v: list[str]) -> list[str]:
        return sorted(set(d.strip().lower() for d in v if d.strip()))

    @field_validator("domain_patterns")
    @classmethod
    def sorted_unique_patterns(cls, v: list[str]) -> list[str]:
        return sorted(set(p.strip() for p in v if p.strip()))


class PolicyArtifact(BaseModel):
    """Published artifact: content + digest + signature metadata."""

    policy: PolicyContent
    hash: str = ""
    signature_b64: str = ""
    signing_scheme: str = "ed25519"
    signer_kid: str | None = None
