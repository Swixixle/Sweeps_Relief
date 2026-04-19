# Discovery pipeline

## Intended flow

1. **Import seeds** — approved sources, manual lists, or feeds (`import-seed`).
2. **Normalize** — dedupe, punycode-safe host extraction (`normalize-domains`).
3. **Classify** — label funnel vs operator vs unknown (tooling evolves here).
4. **Diff** — compare against current production domains (`discover-candidates`).
5. **Sign candidate** — produce a **candidate artifact** with hash and optional signature.
6. **Review** — human always; Oracle co-sign optional.
7. **Promote** — merge into new `PolicyContent`, then `sign-policy` for production.
8. **Publish** — tag / GitHub Release with `policy.json`, `policy.sig`, `pubkey.json`.

## Automation

- GitHub Actions (or similar) may run discovery on a schedule.
- **Do not** auto-merge candidates into production policy without review.

## CLI mapping

| Command | Role |
|---------|------|
| `import-seed` | Normalize seed lines |
| `discover-candidates` | Diff + signed candidate JSON |
| `promote-candidates` | Merge helper toward new content file |
| `sign-policy` / `verify-policy` | Production signing |
