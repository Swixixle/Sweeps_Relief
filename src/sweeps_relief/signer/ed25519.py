"""Ed25519 sign/verify using the cryptography library."""

from __future__ import annotations

import base64
import json
from pathlib import Path
from typing import Any

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey


def generate_keypair() -> tuple[Ed25519PrivateKey, Ed25519PublicKey]:
    private_key = Ed25519PrivateKey.generate()
    return private_key, private_key.public_key()


def load_private_key(pem_path: Path | str) -> Ed25519PrivateKey:
    data = Path(pem_path).read_bytes()
    key = serialization.load_pem_private_key(data, password=None)
    if not isinstance(key, Ed25519PrivateKey):
        raise TypeError("Expected Ed25519 private key")
    return key


def load_public_key(pem_path: Path | str) -> Ed25519PublicKey:
    data = Path(pem_path).read_bytes()
    key = serialization.load_pem_public_key(data)
    if not isinstance(key, Ed25519PublicKey):
        raise TypeError("Expected Ed25519 public key")
    return key


def pubkey_to_json(public_key: Ed25519PublicKey, kid: str | None = None) -> dict[str, Any]:
    raw = public_key.public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
    out: dict[str, Any] = {
        "signing_scheme": "ed25519",
        "public_key_b64": base64.b64encode(raw).decode("ascii"),
    }
    if kid:
        out["kid"] = kid
    return out


def write_pubkey_json(public_key: Ed25519PublicKey, path: Path, kid: str | None = None) -> None:
    path.write_text(json.dumps(pubkey_to_json(public_key, kid=kid), indent=2) + "\n", encoding="utf-8")


def sign_bytes(private_key: Ed25519PrivateKey, message: bytes) -> bytes:
    return private_key.sign(message)


def verify_bytes(public_key: Ed25519PublicKey, message: bytes, signature: bytes) -> bool:
    try:
        public_key.verify(signature, message)
        return True
    except Exception:
        return False
