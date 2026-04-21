"""SIGNING.md envelope verification for Sweeps_Intel artifacts (parallel to internal Relief signing)."""

from .exceptions import (
    EnvelopeError,
    EnvelopeShapeError,
    HashMismatchError,
    RevokedKeyError,
    SignatureVerificationError,
    TrustStoreError,
    UnauthorizedArtifactError,
    UntrustedKeyError,
)
from ._trust_store import TrustStore, TrustedKey, load_trust_store
from .ingest import load_verified_blocklist, load_verified_snapshot
from .verifier import load_public_key_pem, verify_envelope

__all__ = [
    "EnvelopeError",
    "EnvelopeShapeError",
    "HashMismatchError",
    "RevokedKeyError",
    "SignatureVerificationError",
    "TrustStore",
    "TrustStoreError",
    "TrustedKey",
    "UnauthorizedArtifactError",
    "UntrustedKeyError",
    "load_public_key_pem",
    "load_trust_store",
    "load_verified_blocklist",
    "load_verified_snapshot",
    "verify_envelope",
]
