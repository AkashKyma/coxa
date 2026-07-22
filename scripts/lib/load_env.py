"""Load repo-root .env into os.environ (zero deps)."""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def load_env(*extra_files: str | Path) -> None:
    paths = [ROOT / ".env", ROOT / "backend" / ".env", *[Path(p) for p in extra_files]]
    for path in paths:
        if not path.is_file():
            continue
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key = key.strip()
            val = val.strip()
            if (val.startswith('"') and val.endswith('"')) or (
                val.startswith("'") and val.endswith("'")
            ):
                val = val[1:-1]
            os.environ.setdefault(key, val)


def require_env(name: str) -> str:
    val = os.environ.get(name)
    if not val:
        raise SystemExit(
            f"Missing required env var: {name}. Add it to the repo root .env (see .env.example)."
        )
    return val


def env_or(name: str, fallback: str) -> str:
    return os.environ.get(name) or fallback
