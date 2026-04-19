"""Build and verify signed policy artifacts."""

from __future__ import annotations

import base64
from typing import Any

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey

from sweeps_relief.core.canonical_json import canonicalize_json
from sweeps_relief.core.hashing import hash_hex
from sweeps_relief.policy.models import PolicyArtifact, PolicyContent
from sweeps_relief.signer.ed25519 import sign_bytes, verify_bytes


def policy_body_for_signing(content: PolicyContent) -> bytes:
    """Canonical bytes of policy content only (no outer hash/signature)."""
    return canonicalize_json(content.model_dump(mode="json", exclude_none=True))


def build_policy_artifact(
    content: PolicyContent,
    private_key: Ed25519PrivateKey,
    signer_kid: str | None = None,
) -> PolicyArtifact:
    body = policy_body_for_signing(content)
    digest = hash_hex(body)
    sig = sign_bytes(private_key, body)
    return PolicyArtifact(
        policy=content,
        hash=digest,
        signature_b64=base64.b64encode(sig).decode("ascii"),
        signing_scheme="ed25519",
        signer_kid=signer_kid,
    )


def verify_policy_artifact(artifact: PolicyArtifact, public_key: Ed25519PublicKey) -> bool:
    body = policy_body_for_signing(artifact.policy)
    if hash_hex(body) != artifact.hash:
        return False
    try:
        sig = base64.b64decode(artifact.signature_b64, validate=True)
    except Exception:
        return False
    return verify_bytes(public_key, body, sig)


def policy_artifact_to_public_dict(artifact: PolicyArtifact) -> dict[str, Any]:
    """Serialize for policy.json on disk."""
    base = artifact.model_dump(mode="json", exclude_none=True)
    return base
