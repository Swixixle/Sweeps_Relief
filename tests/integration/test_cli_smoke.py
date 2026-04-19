import json
import subprocess
import sys
from pathlib import Path


def test_cli_gen_sign_verify(tmp_path: Path):
    keys = tmp_path / "k"
    keys.mkdir()
    subprocess.run(
        [sys.executable, "-m", "sweeps_relief.cli", "gen-keys", "--out", str(keys)],
        check=True,
        cwd=tmp_path,
    )
    content = tmp_path / "p.json"
    content.write_text(
        json.dumps(
            {
                "schema_version": "1.0",
                "version": "1.0.0",
                "domains": ["smoke.test"],
                "domain_patterns": [],
                "funnel_domains": [],
                "affiliate_domains": [],
                "heuristics": {
                    "keywords": [],
                    "page_indicators": [],
                    "title_indicators": [],
                    "keyword_weights": {},
                },
                "payment_indicators": [],
                "sources": [],
                "metadata": {},
            }
        ),
        encoding="utf-8",
    )
    out = tmp_path / "policy.json"
    subprocess.run(
        [
            sys.executable,
            "-m",
            "sweeps_relief.cli",
            "sign-policy",
            str(content),
            "--private-key",
            str(keys / "private.pem"),
            "--out",
            str(out),
        ],
        check=True,
        cwd=tmp_path,
    )
    r = subprocess.run(
        [
            sys.executable,
            "-m",
            "sweeps_relief.cli",
            "verify-policy",
            str(out),
            "--public-key",
            str(keys / "public.pem"),
        ],
        cwd=tmp_path,
    )
    assert r.returncode == 0
