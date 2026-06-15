#!/usr/bin/env python3
"""
HOOT Coach Graph HTTP sidecar (M14).

  python coach-graph/server.py
  COACH_GRAPH_PORT=7788 python coach-graph/server.py

Endpoints:
  GET  /health
  GET  /spec
  GET  /profiles
  POST /run  { "profile_id", "dry_run"?, "auto_approve"?, "min_score"? }
"""

from __future__ import annotations

import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

from runner import invoke_graph, load_graph_profiles

HOST = os.environ.get("COACH_GRAPH_HOST", "127.0.0.1")
PORT = int(os.environ.get("COACH_GRAPH_PORT", "7788"))
ROOT = Path(__file__).resolve().parent


def _json_response(handler: BaseHTTPRequestHandler, status: int, payload: Any) -> None:
    body = json.dumps(payload, default=str).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


class CoachGraphHandler(BaseHTTPRequestHandler):
    server_version = "HootCoachGraph/0.2"

    def log_message(self, fmt: str, *args: Any) -> None:
        if os.environ.get("COACH_GRAPH_QUIET") == "1":
            return
        super().log_message(fmt, *args)

    def do_GET(self) -> None:
        path = self.path.split("?", 1)[0]
        if path == "/health":
            return _json_response(self, 200, {"status": "ok", "service": "coach-graph", "port": PORT})
        if path == "/spec":
            spec_path = ROOT / "graph.spec.json"
            if not spec_path.exists():
                return _json_response(self, 404, {"error": "graph.spec.json missing"})
            return _json_response(self, 200, json.loads(spec_path.read_text(encoding="utf-8")))
        if path == "/profiles":
            return _json_response(self, 200, load_graph_profiles())
        return _json_response(self, 404, {"error": "not found"})

    def do_POST(self) -> None:
        path = self.path.split("?", 1)[0]
        if path != "/run":
            return _json_response(self, 404, {"error": "not found"})
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        try:
            body = json.loads(raw or "{}")
        except json.JSONDecodeError:
            return _json_response(self, 400, {"error": "invalid JSON body"})
        profile_id = str(body.get("profile_id") or body.get("profileId") or "").strip()
        if not profile_id:
            return _json_response(self, 400, {"error": "profile_id required"})
        try:
            result = invoke_graph(
                profile_id,
                dry_run_mode=bool(body.get("dry_run") or body.get("dryRun")),
                auto_approve=bool(body.get("auto_approve") or body.get("autoApprove")),
                min_score=body.get("min_score") or body.get("minScore"),
            )
            status = 200 if result.get("ok") else 422
            return _json_response(self, status, result)
        except Exception as exc:  # noqa: BLE001
            return _json_response(self, 500, {"ok": False, "error": str(exc)})


def main() -> int:
    httpd = ThreadingHTTPServer((HOST, PORT), CoachGraphHandler)
    print(f"[coach-graph] listening on http://{HOST}:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[coach-graph] stopped")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())