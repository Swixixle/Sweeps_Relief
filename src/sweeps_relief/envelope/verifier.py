"""Verify SIGNING.md envelopes (Intel → Relief). Uses base64url and ensure_ascii=True canonical JSON."""

from __future__ import annotations

import base64
import binascii
import hashlib
import logging
from typing import Any

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

from ._canonical import canonical_payload_bytes
from ._trust_store import TrustStore
from .exceptions import (
    EnvelopeShapeError,
    HashMismatchError,
    RevokedKeyError,
    SignatureVerificationError,
    TrustStoreError,
    UnauthorizedArtifactError,
    UntrustedKeyError,
)

logger = logging.getLogger(__name__)


def load_public_key_pem(pem_string: str) -> Ed25519PublicKey:
    """Load an Ed25519 public key from PEM (SPKI)."""
    try:
        key = serialization.load_pem_public_key(pem_string.encode("utf-8"))
    except ValueError as e:
        raise TrustStoreError(f"invalid public key PEM: {e}") from e
    if not isinstance(key, Ed25519PublicKey):
        raise TrustStoreError("public key must be Ed25519")
    return key


def decode_base64url(s: str) -> bytes:
    """Decode base64url (RFC 4648 section 5); padding optional."""
    t = s.strip().replace("-", "+").replace("_", "/")
    pad = (-len(t)) % 4
    if pad:
        t += "=" * pad
    try:
        return base64.b64decode(t, validate=True)
    except (binascii.Error, ValueError) as e:
        raise EnvelopeShapeError(f"invalid base64url in signature_b64: {e}") from e


def verify_envelope(
    envelope: dict[str, Any],
    trust_store: TrustStore,
    expected_artifact_type: str | None = None,
) -> dict[str, Any]:
    """
    Verify a signed envelope per SIGNING.md. Returns the inner ``payload`` dict on success.

    Steps: shape check → algorithm ed25519 → trust key → optional artifact authorization →
    canonical JSON (ensure_ascii=True) → SHA-256 hex vs payload_hash_sha256 → Ed25519 verify.
    """
    if not isinstance(envelope, dict):
        raise EnvelopeShapeError("envelope must be a JSON object")

    if "payload" not in envelope or "signature" not in envelope:
        raise EnvelopeShapeError("envelope must have payload and signature objects")

    payload = envelope["payload"]
    sig_block = envelope["signature"]

    if not isinstance(payload, dict):
        raise EnvelopeShapeError("payload must be a JSON object")
    if not isinstance(sig_block, dict):
        raise EnvelopeShapeError("signature must be a JSON object")

    try:
        algorithm = sig_block["algorithm"]
        key_id = sig_block["key_id"]
        payload_hash_sha256 = sig_block["payload_hash_sha256"]
        signature_b64 = sig_block["signature_b64"]
    except KeyError as e:
        raise EnvelopeShapeError(f"signature block missing required field: {e.args[0]!r}") from e

    if not isinstance(algorithm, str):
        raise EnvelopeShapeError("signature.algorithm must be a string")
    if algorithm != "ed25519":
        raise SignatureVerificationError(
            f"unsupported signature algorithm: {algorithm!r} (expected ed25519)"
        )

    if not isinstance(key_id, str) or not key_id.strip():
        raise EnvelopeShapeError("signature.key_id must be a non-empty string")

    trusted = trust_store.get_key(key_id)
    if trusted is None:
        raise UntrustedKeyError(f"unknown signing key: {key_id!r}")
    if trusted.is_revoked():
        raise RevokedKeyError(f"signing key is revoked: {key_id!r}")

    if expected_artifact_type is not None:
        if expected_artifact_type not in trusted.authorized_for:
            raise UnauthorizedArtifactError(
                f"key {key_id!r} is not authorized for artifact type {expected_artifact_type!r}"
            )

    if not isinstance(payload_hash_sha256, str):
        raise EnvelopeShapeError("signature.payload_hash_sha256 must be a string")
    if not isinstance(signature_b64, str):
        raise EnvelopeShapeError("signature.signature_b64 must be a string")

    canonical = canonical_payload_bytes(payload)
    computed_hex = hashlib.sha256(canonical).hexdigest()
    if computed_hex != payload_hash_sha256.strip().lower():
        logger.warning(
            "payload hash mismatch: expected %s, got %s",
            payload_hash_sha256,
            computed_hex,
        )
        raise HashMismatchError(
            f"payload_hash_sha256 mismatch: envelope claims {payload_hash_sha256!r}, "
            f"canonical payload hashes to {computed_hex!r}"
        )

    try:
        public_key = load_public_key_pem(trusted.public_key_pem)
    except TrustStoreError:
        raise

    sig_bytes = decode_base64url(signature_b64)
    try:
        public_key.verify(sig_bytes, canonical)
    except InvalidSignature as e:
        raise SignatureVerificationError("Ed25519 verification failed") from e

    return payload
