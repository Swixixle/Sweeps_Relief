"""Tamper-evident event records and signed log bundles."""

from __future__ import annotations

import base64
import binascii
import logging
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey
from pydantic import BaseModel, Field

from sweeps_relief.core.canonical_json import canonicalize_json
from sweeps_relief.core.chain import chain_event
from sweeps_relief.core.hashing import hash_hex
from sweeps_relief.signer.ed25519 import sign_bytes, verify_bytes

logger = logging.getLogger(__name__)


class EventType(str, Enum):
    BLOCKED_NAVIGATION = "blocked_navigation"
    BLOCKED_SEARCH = "blocked_search"
    BLOCKED_REDIRECT = "blocked_redirect"
    BLOCKED_FUNNEL_PAGE = "blocked_funnel_page"
    BLOCKED_PAYMENT_PATH = "blocked_payment_path"
    POLICY_UPDATE_APPLIED = "policy_update_applied"
    POLICY_VERIFICATION_FAILED = "policy_verification_failed"
    TAMPER_ATTEMPT = "tamper_attempt"
    DNS_CHANGE_DETECTED = "dns_change_detected"
    DISABLE_ATTEMPT = "disable_attempt"
    OVERRIDE_REQUESTED = "override_requested"
    OVERRIDE_DENIED = "override_denied"
    RELAPSE_EVENT = "relapse_event"
    COOLDOWN_TRIGGERED = "cooldown_triggered"


class EventRecord(BaseModel):
    event_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ts: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    )
    device_id: str = ""
    event_type: EventType
    target: str = ""
    classification: str = ""
    context: dict[str, Any] = Field(default_factory=dict)
    prev_hash: str = ""
    hash: str = ""
    signature_b64: str = ""

    def body_for_chain(self) -> dict[str, Any]:
        d = self.model_dump(mode="json", exclude_none=True)
        for k in ("hash", "signature_b64"):
            d.pop(k, None)
        return d


def append_event_hash(prev_hash: str | None, record: EventRecord) -> EventRecord:
    body = record.body_for_chain()
    new_hash = chain_event(prev_hash, body)
    record.hash = new_hash
    return record


def sign_event_record(private_key: Ed25519PrivateKey, record: EventRecord) -> EventRecord:
    body = record.body_for_chain()
    if not record.hash:
        raise ValueError("Record must have hash set before signing")
    to_sign = canonicalize_json({"event": body, "hash": record.hash})
    sig = sign_bytes(private_key, to_sign)
    record.signature_b64 = base64.b64encode(sig).decode("ascii")
    return record


class LogBundle(BaseModel):
    """Daily/weekly export: ordered events + bundle signature."""

    bundle_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    period_start: str
    period_end: str
    device_id: str = ""
    events: list[dict[str, Any]] = Field(default_factory=list)
    events_hash: str = ""
    signature_b64: str = ""
    signing_scheme: str = "ed25519"


def sign_log_bundle(
    bundle: LogBundle,
    private_key: Ed25519PrivateKey,
) -> LogBundle:
    events_canon = canonicalize_json(bundle.events)
    bundle.events_hash = hash_hex(events_canon)
    payload = {
        "bundle_id": bundle.bundle_id,
        "period_start": bundle.period_start,
        "period_end": bundle.period_end,
        "device_id": bundle.device_id,
        "events_hash": bundle.events_hash,
    }
    to_sign = canonicalize_json(payload)
    sig = sign_bytes(private_key, to_sign)
    bundle.signature_b64 = base64.b64encode(sig).decode("ascii")
    return bundle


def verify_log_bundle(bundle: LogBundle, public_key: Ed25519PublicKey) -> bool:
    events_canon = canonicalize_json(bundle.events)
    if hash_hex(events_canon) != bundle.events_hash:
        return False
    payload = {
        "bundle_id": bundle.bundle_id,
        "period_start": bundle.period_start,
        "period_end": bundle.period_end,
        "device_id": bundle.device_id,
        "events_hash": bundle.events_hash,
    }
    to_sign = canonicalize_json(payload)
    # Distinguish expected integrity failures (return False) from unexpected bugs (logged at error level)
    try:
        sig = base64.b64decode(bundle.signature_b64, validate=True)
    except (binascii.Error, ValueError, TypeError) as e:
        logger.warning(
            "invalid log bundle signature_b64 (decode failed): %s: %s",
            type(e).__name__,
            e,
        )
        return False
    except Exception:
        logger.exception("unexpected error in verify_log_bundle")
        return False
    return verify_bytes(public_key, to_sign, sig)
