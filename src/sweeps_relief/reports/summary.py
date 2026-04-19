"""Human-readable signed summaries (Markdown); PDF deferred."""

from __future__ import annotations

from typing import Any


def build_markdown_summary(
    *,
    title: str,
    policy_version: str,
    sections: dict[str, Any],
) -> str:
    lines = [
        f"# {title}",
        "",
        f"**Policy version:** {policy_version}",
        "",
    ]
    for heading, body in sections.items():
        lines.append(f"## {heading}")
        lines.append("")
        if isinstance(body, str):
            lines.append(body)
        else:
            lines.append(f"```json\n{body}\n```")
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"
