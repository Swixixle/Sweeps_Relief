"""Domain normalization and seed import."""

from __future__ import annotations

import re
from urllib.parse import urlparse


def normalize_domain(raw: str) -> str | None:
    """
    Strip whitespace, lower-case, extract host from URL-like strings.
    Returns None if nothing usable remains.
    """
    s = raw.strip()
    if not s or s.startswith("#"):
        return None
    if "://" not in s and "/" in s:
        s = "http://" + s.split("/")[0]
    if "://" in s:
        try:
            p = urlparse(s)
            host = (p.hostname or "").lower()
        except Exception:
            return None
    else:
        host = s.lower().split("/")[0].split(":")[0]
    host = host.rstrip(".")
    if not host or not _looks_like_domain(host):
        return None
    return host


_DOMAIN_RE = re.compile(
    r"^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$|^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)$"
)


def _looks_like_domain(host: str) -> bool:
    if len(host) > 253:
        return False
    return bool(_DOMAIN_RE.match(host))


def normalize_seed_lines(lines: list[str]) -> list[str]:
    out: set[str] = set()
    for line in lines:
        d = normalize_domain(line)
        if d:
            out.add(d)
    return sorted(out)
