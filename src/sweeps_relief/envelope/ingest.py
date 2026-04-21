"""Load and verify Intel-published artifacts (signed envelopes only)."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from ._trust_store import TrustStore
from .exceptions import EnvelopeShapeError
from .verifier import verify_envelope

logger = logging.getLogger(__name__)


def _load_json_object(path: Path, label: str) -> dict[str, Any]:
    try:
        text = path.read_text(encoding="utf-8")
    except FileNotFoundError:
        raise
    except OSError as e:
        raise EnvelopeShapeError(f"cannot read {label}: {e}") from e

    try:
        doc = json.loads(text)
    except json.JSONDecodeError as e:
        raise EnvelopeShapeError(f"{label} is not valid JSON: {e}") from e

    if not isinstance(doc, dict):
        raise EnvelopeShapeError(f"{label} must be a JSON object")
    return doc


def load_verified_snapshot(path: Path, trust_store: TrustStore) -> dict[str, Any]:
    """
    Read ``intel_snapshot.json``, verify as a signed envelope, return inner payload.

    Relief does not consume unsigned Intel artifacts (end of trust chain).
    """
    logger.debug("load_verified_snapshot: %s", path)
    doc = _load_json_object(path, str(path))
    if "payload" not in doc or "signature" not in doc:
        raise EnvelopeShapeError(
            "Intel snapshot must be a signed envelope with payload and signature blocks"
        )
    return verify_envelope(doc, trust_store, expected_artifact_type="intel_snapshot")


def load_verified_blocklist(path: Path, trust_store: TrustStore) -> dict[str, Any]:
    """Read blocklist artifact path, verify envelope for ``intel_block_candidates``."""
    logger.debug("load_verified_blocklist: %s", path)
    doc = _load_json_object(path, str(path))
    if "payload" not in doc or "signature" not in doc:
        raise EnvelopeShapeError(
            "Intel blocklist artifact must be a signed envelope with payload and signature blocks"
        )
    return verify_envelope(doc, trust_store, expected_artifact_type="intel_block_candidates")
