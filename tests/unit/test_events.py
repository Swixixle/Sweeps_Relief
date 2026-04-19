from sweeps_relief.logger.events import (
    EventRecord,
    EventType,
    LogBundle,
    append_event_hash,
    sign_event_record,
    sign_log_bundle,
    verify_log_bundle,
)
from sweeps_relief.signer.ed25519 import generate_keypair


def test_event_chain_and_sign():
    priv, pub = generate_keypair()
    ev = EventRecord(event_type=EventType.BLOCKED_NAVIGATION, target="https://x.test", device_id="d1")
    ev = append_event_hash(None, ev)
    ev = sign_event_record(priv, ev)
    assert ev.hash and ev.signature_b64


def test_log_bundle_verify():
    priv, pub = generate_keypair()
    b = LogBundle(period_start="2026-01-01", period_end="2026-01-02", events=[{"a": 1}])
    b = sign_log_bundle(b, priv)
    assert verify_log_bundle(b, pub)
    b.events.append({"b": 2})
    assert not verify_log_bundle(b, pub)
