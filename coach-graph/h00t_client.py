"""HTTP client for HOOT kernel APIs (localhost only)."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any

DEFAULT_BASE = os.environ.get("HOOT_BASE", "http://127.0.0.1:7777")


def _request(method: str, path: str, body: dict | None = None, base: str = DEFAULT_BASE) -> Any:
    url = f"{base.rstrip('/')}{path}"
    data = None
    headers = {"Accept": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {path} failed ({exc.code}): {detail}") from exc


def fetch_scan(base: str = DEFAULT_BASE) -> dict:
    return _request("GET", "/api/scan", base=base)


def fetch_profiles(base: str = DEFAULT_BASE) -> list[dict]:
    out = _request("GET", "/api/profiles", base=base)
    return out if isinstance(out, list) else out.get("profiles", [])


def profile_score(profile_id: str, base: str = DEFAULT_BASE) -> int:
    for row in fetch_profiles(base=base):
        if row.get("id") == profile_id:
            return int(row.get("score") or 0)
    return 0


def dry_run_launch(profile_id: str, base: str = DEFAULT_BASE) -> dict:
    return _request("POST", f"/api/launch/{profile_id}", {"dryRun": True}, base=base)


def launch_profile(profile_id: str, base: str = DEFAULT_BASE) -> dict:
    return _request("POST", f"/api/launch/{profile_id}", {}, base=base)


def append_memory_evidence(profile_id: str, status: str, reason: str, base: str = DEFAULT_BASE) -> dict:
    return _request(
        "POST",
        "/api/coach/execute",
        {
            "command": {
                "type": "appendMemory",
                "profile": profile_id,
                "status": status,
                "reason": reason,
            }
        },
        base=base,
    )