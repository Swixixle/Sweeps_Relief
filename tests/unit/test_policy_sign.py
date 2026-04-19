import json

from sweeps_relief.policy.build import (
    build_policy_artifact,
    policy_body_for_signing,
    verify_policy_artifact,
)
from sweeps_relief.policy.models import HeuristicsBlock, PolicyContent
from sweeps_relief.signer.ed25519 import generate_keypair


def test_sign_and_verify_roundtrip():
    priv, pub = generate_keypair()
    content = PolicyContent(
        version="1.0.0",
        domains=["example-sweeps.test"],
        funnel_domains=[],
        affiliate_domains=[],
        heuristics=HeuristicsBlock(keywords=["sweeps"]),
        payment_indicators=["deposit"],
        sources=[],
    )
    body = policy_body_for_signing(content)
    assert b"signature" not in body.lower()
    art = build_policy_artifact(content, priv, signer_kid="test")
    assert verify_policy_artifact(art, pub)
    # Tamper should fail
    art.policy.domains = ["other.test"]
    assert not verify_policy_artifact(art, pub)


def test_policy_json_roundtrip():
    priv, pub = generate_keypair()
    content = PolicyContent(version="1.0.0", domains=["a.test"])
    art = build_policy_artifact(content, priv)
    raw = json.loads(json.dumps(art.model_dump(mode="json")))
    from sweeps_relief.policy.models import PolicyArtifact

    art2 = PolicyArtifact.model_validate(raw)
    assert verify_policy_artifact(art2, pub)
