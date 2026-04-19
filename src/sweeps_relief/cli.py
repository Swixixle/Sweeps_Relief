"""Typer CLI: policy pipeline, exports, verification, discovery."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Annotated, Any

import typer
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from sweeps_relief.discovery.candidates import build_candidate_artifact, diff_domains
from sweeps_relief.discovery.normalize import normalize_seed_lines
from sweeps_relief.exports.browser import export_browser_rules_json
from sweeps_relief.exports.dns import export_dns_denylist
from sweeps_relief.exports.hosts import export_hosts_file
from sweeps_relief.policy.build import (
    build_policy_artifact,
    policy_artifact_to_public_dict,
    verify_policy_artifact,
)
from sweeps_relief.policy.models import HeuristicsBlock, PolicyArtifact, PolicyContent
from sweeps_relief.reports.summary import build_markdown_summary
from sweeps_relief.signer.ed25519 import (
    generate_keypair,
    load_private_key,
    load_public_key,
    write_pubkey_json,
)

app = typer.Typer(no_args_is_help=True, help="Sweeps_Relief policy and export tooling.")


@app.command("gen-keys")
def gen_keys(
    out_dir: Annotated[Path, typer.Option("--out", help="Directory for key.pem and pubkey.json")],
    kid: Annotated[str | None, typer.Option(help="Optional key id for pubkey.json")] = None,
) -> None:
    """Generate an Ed25519 keypair (PEM + pubkey.json)."""
    out_dir.mkdir(parents=True, exist_ok=True)
    priv, pub = generate_keypair()
    priv_pem = priv.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    (out_dir / "private.pem").write_bytes(priv_pem)
    pub_pem = pub.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    (out_dir / "public.pem").write_bytes(pub_pem)
    write_pubkey_json(pub, out_dir / "pubkey.json", kid=kid)
    typer.echo(f"Wrote keys to {out_dir}")


@app.command("import-seed")
def import_seed(
    input_file: Path,
    output: Path = Path("-"),
) -> None:
    """Read seed lines (domains or URLs) and write normalized unique domains, one per line."""
    lines = input_file.read_text(encoding="utf-8").splitlines()
    normalized = normalize_seed_lines(lines)
    text = "\n".join(normalized) + ("\n" if normalized else "")
    if str(output) == "-":
        typer.echo(text, nl=False)
    else:
        output.write_text(text, encoding="utf-8")
        typer.echo(f"Wrote {len(normalized)} domains to {output}")


@app.command("normalize-domains")
def normalize_domains_cmd(
    input_file: Path,
    output: Path = Path("-"),
) -> None:
    """Alias for import-seed (normalize and dedupe)."""
    import_seed(input_file, output)


def _load_policy_content(path: Path) -> PolicyContent:
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, dict) and "policy" in data:
        return PolicyArtifact.model_validate(data).policy
    return PolicyContent.model_validate(data)


@app.command("build-policy")
def build_policy(
    domains_file: Path | None = None,
    version: str = "0.1.0",
    out: Path = Path("data/published/policy.content.json"),
) -> None:
    """Build a PolicyContent JSON from a normalized domain list (optional) and defaults."""
    domains: list[str] = []
    if domains_file and domains_file.exists():
        domains = normalize_seed_lines(domains_file.read_text(encoding="utf-8").splitlines())
    content = PolicyContent(
        version=version,
        domains=domains,
        funnel_domains=[],
        affiliate_domains=[],
        heuristics=HeuristicsBlock(
            keywords=["sweeps", "sweepstakes casino", "gold coins", "social casino"],
            page_indicators=["redeem", "sweepstakes"],
            title_indicators=["free coins"],
        ),
        payment_indicators=["checkout", "cashier", "deposit"],
        sources=[],
    )
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        json.dumps(content.model_dump(mode="json"), indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    typer.echo(f"Wrote policy content to {out}")


@app.command("sign-policy")
def sign_policy(
    content_path: Path,
    private_key: Annotated[Path, typer.Option("--private-key", "-k", help="PEM Ed25519 private key")],
    out: Annotated[Path, typer.Option("--out", "-o")] = Path("data/published/policy.json"),
    kid: Annotated[str | None, typer.Option(help="Optional signer key id")] = None,
) -> None:
    """Sign policy content and write policy.json artifact."""
    content = _load_policy_content(content_path)
    key = load_private_key(private_key)
    artifact = build_policy_artifact(content, key, signer_kid=kid)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        json.dumps(policy_artifact_to_public_dict(artifact), indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    sig_path = out.with_name(out.stem + ".sig")
    # Optional detached .sig file: raw base64 line
    sig_path.write_text(artifact.signature_b64 + "\n", encoding="utf-8")
    typer.echo(f"Wrote {out} and {sig_path}")


@app.command("verify-policy")
def verify_policy(
    policy_path: Path,
    public_key: Annotated[Path, typer.Option("--public-key", "-p", help="PEM Ed25519 public key")],
) -> None:
    """Verify policy.json against an Ed25519 public key."""
    data = json.loads(policy_path.read_text(encoding="utf-8"))
    artifact = PolicyArtifact.model_validate(data)
    key = load_public_key(public_key)
    ok = verify_policy_artifact(artifact, key)
    if ok:
        typer.echo("OK: policy signature and hash match.")
        raise typer.Exit(0)
    typer.echo("FAILED: verification failed.", err=True)
    raise typer.Exit(1)


@app.command("diff-policy")
def diff_policy(
    old_path: Path,
    new_path: Path,
) -> None:
    """Diff two PolicyContent JSON files (domain sets)."""
    old_c = _load_policy_content(old_path)
    new_c = _load_policy_content(new_path)
    d = diff_domains(old_c.domains, new_c.domains)
    typer.echo(json.dumps(d, indent=2))


@app.command("discover-candidates")
def discover_candidates(
    current_policy: Path,
    seed_file: Path,
    out: Annotated[Path, typer.Option("--out", "-o")] = Path("data/candidates/candidates.json"),
    private_key: Annotated[Path | None, typer.Option("--private-key")] = None,
) -> None:
    """
    Diff normalized seeds against current policy domains; write signed candidate artifact.
    Does not promote to production policy.
    """
    current = _load_policy_content(current_policy)
    seeds = normalize_seed_lines(seed_file.read_text(encoding="utf-8").splitlines())
    diff = diff_domains(current.domains, seeds)
    key: Ed25519PrivateKey | None = None
    if private_key is not None:
        key = load_private_key(private_key)
    art = build_candidate_artifact(
        version="candidate-0.1",
        added=diff["added"],
        removed=diff["removed"],
        source=str(seed_file),
        private_key=key,
    )
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(art, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    typer.echo(f"Wrote candidate artifact to {out}")


@app.command("promote-candidates")
def promote_candidates(
    candidate_path: Path,
    merged_content_out: Path,
    version: str,
    base_policy: Annotated[Path | None, typer.Option("--base")] = None,
) -> None:
    """
    Manual promotion step: merge candidate 'added' into a new PolicyContent file for review.
    Does not sign or publish automatically.
    """
    raw = json.loads(candidate_path.read_text(encoding="utf-8"))
    added = raw.get("added", [])
    if base_policy is not None:
        prev = _load_policy_content(base_policy)
        merged_domains = sorted(set(prev.domains) | set(added))
        base = prev.model_copy(update={"version": version, "domains": merged_domains})
    else:
        base = PolicyContent(
            version=version,
            domains=sorted(set(added)),
            funnel_domains=[],
            affiliate_domains=[],
            heuristics=HeuristicsBlock(),
            payment_indicators=[],
            sources=[],
        )
    merged_content_out.parent.mkdir(parents=True, exist_ok=True)
    merged_content_out.write_text(
        json.dumps(base.model_dump(mode="json"), indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    typer.echo(f"Wrote merged content to {merged_content_out} — review before sign-policy.")


@app.command("export-hosts")
def export_hosts(
    policy_path: Path,
    out: Path = Path("-"),
) -> None:
    data = json.loads(policy_path.read_text(encoding="utf-8"))
    artifact = PolicyArtifact.model_validate(data)
    text = export_hosts_file(artifact.policy)
    if str(out) == "-":
        typer.echo(text, nl=False)
    else:
        out.write_text(text, encoding="utf-8")


@app.command("export-dns-blocklist")
def export_dns_blocklist(
    policy_path: Path,
    out: Path = Path("-"),
) -> None:
    data = json.loads(policy_path.read_text(encoding="utf-8"))
    artifact = PolicyArtifact.model_validate(data)
    text = export_dns_denylist(artifact.policy)
    if str(out) == "-":
        typer.echo(text, nl=False)
    else:
        out.write_text(text, encoding="utf-8")


@app.command("export-browser-rules")
def export_browser_rules(
    policy_path: Path,
    out: Path = Path("-"),
) -> None:
    data = json.loads(policy_path.read_text(encoding="utf-8"))
    artifact = PolicyArtifact.model_validate(data)
    text = export_browser_rules_json(artifact.policy)
    if str(out) == "-":
        typer.echo(text, nl=False)
    else:
        out.write_text(text, encoding="utf-8")


@app.command("build-report")
def build_report(
    policy_path: Path,
    out: Path = Path("-"),
) -> None:
    """Build a Markdown summary for human review (not auto-emailed)."""
    data = json.loads(policy_path.read_text(encoding="utf-8"))
    artifact = PolicyArtifact.model_validate(data)
    p = artifact.policy
    md = build_markdown_summary(
        title="Sweeps_Relief policy summary",
        policy_version=p.version,
        sections={
            "Coverage": f"- Domains: {len(p.domains)}\n- Funnel: {len(p.funnel_domains)}\n- Affiliates: {len(p.affiliate_domains)}",
            "Heuristics": json.dumps(p.heuristics.model_dump(), indent=2),
        },
    )
    if str(out) == "-":
        typer.echo(md, nl=False)
    else:
        out.write_text(md, encoding="utf-8")


def main() -> None:
    app()


if __name__ == "__main__":
    main()
