"""Exceptions for SIGNING.md envelope verification (parallel to Intel's hierarchy)."""


class EnvelopeError(Exception):
    """Base class for envelope and trust-store failures."""

    pass


class TrustStoreError(EnvelopeError):
    """Failed to load or parse ``trust_store.json`` or invalid key material in store."""

    pass


class SignatureVerificationError(EnvelopeError):
    """Signature check failed (algorithm, crypto, or envelope semantics)."""

    pass


class HashMismatchError(SignatureVerificationError):
    """``payload_hash_sha256`` did not match the canonical payload."""

    pass


class EnvelopeShapeError(SignatureVerificationError):
    """Malformed envelope (missing keys or wrong types)."""

    pass


class UntrustedKeyError(SignatureVerificationError):
    """``key_id`` is not present in the trust store."""

    pass


class RevokedKeyError(SignatureVerificationError):
    """The signing key is revoked in the trust store."""

    pass


class UnauthorizedArtifactError(SignatureVerificationError):
    """Key is not authorized for this artifact type."""

    pass
