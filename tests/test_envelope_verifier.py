"""Tests for SIGNING.md envelope verification (Relief, parallel to Intel)."""

from __future__ import annotations

import base64
import hashlib
import json
from datetime import datetime, timezone

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from sweeps_relief.envelope._canonical import canonical_payload_bytes
from sweeps_relief.envelope._trust_store import TrustedKey, TrustStore
from sweeps_relief.envelope.exceptions import (
    EnvelopeError,
    EnvelopeShapeError,
    HashMismatchError,
    RevokedKeyError,
    SignatureVerificationError,
    TrustStoreError,
    UnauthorizedArtifactError,
    UntrustedKeyError,
)
from sweeps_relief.envelope.verifier import decode_base64url, load_public_key_pem, verify_envelope


def _pem_from_public(pub) -> str:
    return (
        pub.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        .decode("utf-8")
        .strip()
    )


def _compute_hash_hex(canonical: bytes) -> str:
    return hashlib.sha256(canonical).hexdigest()


def _make_envelope(
    payload: dict,
    private_key: Ed25519PrivateKey,
    *,
    key_id: str = "intel-snapshot-key-v1",
    algorithm: str = "ed25519",
    signed_at: str | None = None,
    override_hash: str | None = None,
    override_sig_b64: str | None = None,
) -> dict:
    canonical = canonical_payload_bytes(payload)
    h = _compute_hash_hex(canonical)
    sig = private_key.sign(canonical)
    b64 = base64.urlsafe_b64encode(sig).decode("ascii").rstrip("=")
    ts = signed_at or datetime.now(timezone.utc).replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")
    return {
        "payload": payload,
        "signature": {
            "algorithm": algorithm,
            "key_id": key_id,
            "signed_at": ts,
            "payload_hash_sha256": override_hash if override_hash is not None else h,
            "signature_b64": override_sig_b64 if override_sig_b64 is not None else b64,
        },
    }


def _store_with_keys(keys: list[TrustedKey]) -> TrustStore:
    return TrustStore(schema_version=1, updated_at="2026-04-21T00:00:00Z", keys=keys)


def test_trust_store_error_subclass_of_envelope_error() -> None:
    assert issubclass(TrustStoreError, EnvelopeError)


def test_verify_without_expected_artifact_type_skips_authorized_for_check() -> None:
    priv = Ed25519PrivateKey.generate()
    pem = _pem_from_public(priv.public_key())
    payload = {"schema_version": 1}
    env = _make_envelope(payload, priv)
    ts = _store_with_keys(
        [
            TrustedKey(
                key_id="intel-snapshot-key-v1",
                algorithm="ed25519",
                public_key_pem=pem,
                issued_at="2026-04-21T00:00:00Z",
                authorized_for=["intel_snapshot"],
            )
        ]
    )
    assert verify_envelope(env, ts, expected_artifact_type=None) == payload


def test_invalid_trust_store_pem_raises_trust_store_error() -> None:
    priv = Ed25519PrivateKey.generate()
    payload = {"x": 1}
    env = _make_envelope(payload, priv)
    ts = _store_with_keys(
        [
            TrustedKey(
                key_id="intel-snapshot-key-v1",
                algorithm="ed25519",
                public_key_pem="not valid pem",
                issued_at="2026-04-21T00:00:00Z",
                authorized_for=["intel_snapshot"],
            )
        ]
    )
    with pytest.raises(TrustStoreError, match="invalid public key PEM|invalid PEM"):
        verify_envelope(env, ts, expected_artifact_type="intel_snapshot")


def test_happy_path_verify_returns_payload() -> None:
    priv = Ed25519PrivateKey.generate()
    pem = _pem_from_public(priv.public_key())
    payload = {"snapshots": [], "meta": {"k": "v"}}
    env = _make_envelope(payload, priv)
    ts = _store_with_keys(
        [
            TrustedKey(
                key_id="intel-snapshot-key-v1",
                algorithm="ed25519",
                public_key_pem=pem,
                issued_at="2026-04-21T00:00:00Z",
                authorized_for=["intel_snapshot"],
            )
        ]
    )
    assert verify_envelope(env, ts, expected_artifact_type="intel_snapshot") == payload


def test_wrong_public_key_for_key_id_raises_signature_verification_error() -> None:
    priv_sign = Ed25519PrivateKey.generate()
    priv_other = Ed25519PrivateKey.generate()
    wrong_pem = _pem_from_public(priv_other.public_key())
    payload = {"x": 1}
    env = _make_envelope(payload, priv_sign)
    ts = _store_with_keys(
        [
            TrustedKey(
                key_id="intel-snapshot-key-v1",
                algorithm="ed25519",
                public_key_pem=wrong_pem,
                issued_at="2026-04-21T00:00:00Z",
                authorized_for=["intel_snapshot"],
            )
        ]
    )
    with pytest.raises(SignatureVerificationError, match="Ed25519 verification failed"):
        verify_envelope(env, ts, expected_artifact_type="intel_snapshot")


def test_tampered_payload_hash_mismatch() -> None:
    priv = Ed25519PrivateKey.generate()
    pem = _pem_from_public(priv.public_key())
    payload = {"a": 1}
    env = _make_envelope(payload, priv)
    env["payload"]["a"] = 2
    ts = _store_with_keys(
        [
            TrustedKey(
                key_id="intel-snapshot-key-v1",
                algorithm="ed25519",
                public_key_pem=pem,
                issued_at="2026-04-21T00:00:00Z",
                authorized_for=["intel_snapshot"],
            )
        ]
    )
    with pytest.raises(HashMismatchError, match="payload_hash_sha256 mismatch"):
        verify_envelope(env, ts, expected_artifact_type="intel_snapshot")


def test_untrusted_key_id() -> None:
    priv = Ed25519PrivateKey.generate()
    pem = _pem_from_public(priv.public_key())
    payload = {"x": 1}
    env = _make_envelope(payload, priv, key_id="unknown-key")
    ts = _store_with_keys(
        [
            TrustedKey(
                key_id="intel-snapshot-key-v1",
                algorithm="ed25519",
                public_key_pem=pem,
                issued_at="2026-04-21T00:00:00Z",
                authorized_for=["intel_snapshot"],
            )
        ]
    )
    with pytest.raises(UntrustedKeyError, match="unknown-key"):
        verify_envelope(env, ts, expected_artifact_type="intel_snapshot")


def test_revoked_key() -> None:
    priv = Ed25519PrivateKey.generate()
    pem = _pem_from_public(priv.public_key())
    payload = {"x": 1}
    env = _make_envelope(payload, priv)
    ts = _store_with_keys(
        [
            TrustedKey(
                key_id="intel-snapshot-key-v1",
                algorithm="ed25519",
                public_key_pem=pem,
                issued_at="2026-04-21T00:00:00Z",
                authorized_for=["intel_snapshot"],
                revoked_at="2026-04-22T00:00:00Z",
                revocation_reason="rotated",
            )
        ]
    )
    with pytest.raises(RevokedKeyError, match="revoked"):
        verify_envelope(env, ts, expected_artifact_type="intel_snapshot")


def test_unauthorized_artifact_type() -> None:
    priv = Ed25519PrivateKey.generate()
    pem = _pem_from_public(priv.public_key())
    payload = {"x": 1}
    env = _make_envelope(payload, priv)
    ts = _store_with_keys(
        [
            TrustedKey(
                key_id="intel-snapshot-key-v1",
                algorithm="ed25519",
                public_key_pem=pem,
                issued_at="2026-04-21T00:00:00Z",
                authorized_for=["intel_snapshot"],
            )
        ]
    )
    with pytest.raises(UnauthorizedArtifactError, match="intel_block_candidates"):
        verify_envelope(env, ts, expected_artifact_type="intel_block_candidates")


def test_hash_mismatch_explicit() -> None:
    priv = Ed25519PrivateKey.generate()
    pem = _pem_from_public(priv.public_key())
    payload = {"x": 1}
    env = _make_envelope(payload, priv, override_hash="0" * 64)
    ts = _store_with_keys(
        [
            TrustedKey(
                key_id="intel-snapshot-key-v1",
                algorithm="ed25519",
                public_key_pem=pem,
                issued_at="2026-04-21T00:00:00Z",
                authorized_for=["intel_snapshot"],
            )
        ]
    )
    with pytest.raises(HashMismatchError, match="payload_hash_sha256 mismatch"):
        verify_envelope(env, ts, expected_artifact_type="intel_snapshot")


def test_tampered_signature_b64() -> None:
    priv = Ed25519PrivateKey.generate()
    pem = _pem_from_public(priv.public_key())
    payload = {"x": 1}
    env = _make_envelope(payload, priv)
    sig_b64 = env["signature"]["signature_b64"]
    pad = (-len(sig_b64)) % 4
    sig_bytes = bytearray(base64.urlsafe_b64decode(sig_b64 + ("=" * pad)))
    sig_bytes[0] ^= 0x01
    env["signature"]["signature_b64"] = base64.urlsafe_b64encode(bytes(sig_bytes)).decode("ascii").rstrip("=")
    ts = _store_with_keys(
        [
            TrustedKey(
                key_id="intel-snapshot-key-v1",
                algorithm="ed25519",
                public_key_pem=pem,
                issued_at="2026-04-21T00:00:00Z",
                authorized_for=["intel_snapshot"],
            )
        ]
    )
    with pytest.raises(SignatureVerificationError, match="Ed25519 verification failed"):
        verify_envelope(env, ts, expected_artifact_type="intel_snapshot")


def test_missing_signature_block() -> None:
    ts = _store_with_keys([])
    with pytest.raises(EnvelopeShapeError, match="payload and signature"):
        verify_envelope({"payload": {}}, ts)


def test_envelope_not_object() -> None:
    ts = _store_with_keys([])
    with pytest.raises(EnvelopeShapeError, match="JSON object"):
        verify_envelope([], ts)  # type: ignore[arg-type]


def test_wrong_algorithm() -> None:
    priv = Ed25519PrivateKey.generate()
    pem = _pem_from_public(priv.public_key())
    payload = {"x": 1}
    env = _make_envelope(payload, priv, algorithm="rsa")
    ts = _store_with_keys(
        [
            TrustedKey(
                key_id="intel-snapshot-key-v1",
                algorithm="ed25519",
                public_key_pem=pem,
                issued_at="2026-04-21T00:00:00Z",
                authorized_for=["intel_snapshot"],
            )
        ]
    )
    with pytest.raises(SignatureVerificationError, match="unsupported signature algorithm"):
        verify_envelope(env, ts, expected_artifact_type="intel_snapshot")


def test_base64url_padded_and_unpadded_equivalent() -> None:
    raw = b"\xff\x00hello"
    padded = base64.urlsafe_b64encode(raw).decode("ascii")
    unpadded = padded.rstrip("=")
    assert decode_base64url(padded) == raw
    assert decode_base64url(unpadded) == raw


def test_ed25519_signing_same_payload_twice_is_deterministic() -> None:
    priv = Ed25519PrivateKey.generate()
    payload = {"a": 1, "b": [2, 3]}
    c = canonical_payload_bytes(payload)
    s1 = priv.sign(c)
    s2 = priv.sign(c)
    assert s1 == s2


def test_load_public_key_pem_invalid_string() -> None:
    with pytest.raises(TrustStoreError, match="invalid public key PEM|invalid PEM"):
        load_public_key_pem("not pem")


def test_canonical_json_matches_intel_style_dumps() -> None:
    payload = {"unicode": "café", "nested": {"z": 1, "a": 2}}
    relief = canonical_payload_bytes(payload)
    intel_style = json.dumps(
        payload,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=True,
    ).encode("utf-8")
    assert relief == intel_style
