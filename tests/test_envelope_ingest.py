"""Tests for envelope ingest helpers (Intel artifacts on disk)."""

from __future__ import annotations

import base64
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from sweeps_relief.envelope._canonical import canonical_payload_bytes
from sweeps_relief.envelope._trust_store import TrustedKey, TrustStore
from sweeps_relief.envelope.exceptions import EnvelopeShapeError, UnauthorizedArtifactError
from sweeps_relief.envelope.ingest import load_verified_blocklist, load_verified_snapshot


def _pem_from_public(pub) -> str:
    return (
        pub.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        .decode("utf-8")
        .strip()
    )


def _write_signed_snapshot(path: Path, priv: Ed25519PrivateKey, key_id: str) -> dict:
    payload = {"schema_version": 1, "rows": []}
    canonical = canonical_payload_bytes(payload)
    h = hashlib.sha256(canonical).hexdigest()
    sig = priv.sign(canonical)
    b64 = base64.urlsafe_b64encode(sig).decode("ascii").rstrip("=")
    ts = datetime.now(timezone.utc).replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")
    doc = {
        "payload": payload,
        "signature": {
            "algorithm": "ed25519",
            "key_id": key_id,
            "signed_at": ts,
            "payload_hash_sha256": h,
            "signature_b64": b64,
        },
    }
    path.write_text(json.dumps(doc, indent=2), encoding="utf-8")
    return payload


def _store_for_key(priv: Ed25519PrivateKey, *, authorized_for: list[str], key_id: str) -> TrustStore:
    pem = _pem_from_public(priv.public_key())
    return TrustStore(
        schema_version=1,
        updated_at="2026-04-21T00:00:00Z",
        keys=[
            TrustedKey(
                key_id=key_id,
                algorithm="ed25519",
                public_key_pem=pem,
                issued_at="2026-04-21T00:00:00Z",
                authorized_for=authorized_for,
            )
        ],
    )


def test_load_verified_snapshot_happy_path(tmp_path: Path) -> None:
    priv = Ed25519PrivateKey.generate()
    p = tmp_path / "intel_snapshot.json"
    inner = _write_signed_snapshot(p, priv, "intel-snapshot-key-v1")
    ts = _store_for_key(priv, authorized_for=["intel_snapshot"], key_id="intel-snapshot-key-v1")
    assert load_verified_snapshot(p, ts) == inner


def test_load_verified_blocklist_happy_path(tmp_path: Path) -> None:
    priv = Ed25519PrivateKey.generate()
    p = tmp_path / "block_candidates.json"
    payload = {"candidates": []}
    canonical = canonical_payload_bytes(payload)
    h = hashlib.sha256(canonical).hexdigest()
    sig = priv.sign(canonical)
    b64 = base64.urlsafe_b64encode(sig).decode("ascii").rstrip("=")
    ts_iso = datetime.now(timezone.utc).replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")
    doc = {
        "payload": payload,
        "signature": {
            "algorithm": "ed25519",
            "key_id": "intel-blocklist-key-v1",
            "signed_at": ts_iso,
            "payload_hash_sha256": h,
            "signature_b64": b64,
        },
    }
    p.write_text(json.dumps(doc), encoding="utf-8")
    ts = _store_for_key(priv, authorized_for=["intel_block_candidates"], key_id="intel-blocklist-key-v1")
    assert load_verified_blocklist(p, ts) == payload


def test_unsigned_artifact_rejected(tmp_path: Path) -> None:
    priv = Ed25519PrivateKey.generate()
    p = tmp_path / "intel_snapshot.json"
    p.write_text(json.dumps({"schema_version": 1, "plain": True}), encoding="utf-8")
    ts = _store_for_key(priv, authorized_for=["intel_snapshot"], key_id="intel-snapshot-key-v1")
    with pytest.raises(EnvelopeShapeError, match="signed envelope"):
        load_verified_snapshot(p, ts)


def test_missing_file_raises_file_not_found(tmp_path: Path) -> None:
    priv = Ed25519PrivateKey.generate()
    ts = _store_for_key(priv, authorized_for=["intel_snapshot"], key_id="intel-snapshot-key-v1")
    with pytest.raises(FileNotFoundError):
        load_verified_snapshot(tmp_path / "nope.json", ts)


def test_wrong_artifact_type_unauthorized(tmp_path: Path) -> None:
    priv = Ed25519PrivateKey.generate()
    p = tmp_path / "intel_snapshot.json"
    _write_signed_snapshot(p, priv, "intel-snapshot-key-v1")
    ts = _store_for_key(priv, authorized_for=["intel_block_candidates"], key_id="intel-snapshot-key-v1")
    with pytest.raises(UnauthorizedArtifactError, match="intel_snapshot"):
        load_verified_snapshot(p, ts)


def test_malformed_json_envelope_shape_error(tmp_path: Path) -> None:
    priv = Ed25519PrivateKey.generate()
    p = tmp_path / "intel_snapshot.json"
    p.write_text("{ not json", encoding="utf-8")
    ts = _store_for_key(priv, authorized_for=["intel_snapshot"], key_id="intel-snapshot-key-v1")
    with pytest.raises(EnvelopeShapeError, match="not valid JSON"):
        load_verified_snapshot(p, ts)
