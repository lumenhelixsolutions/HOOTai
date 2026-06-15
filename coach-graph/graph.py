#!/usr/bin/env python3
"""
HOOT launch-approval LangGraph sidecar (CLI).

Usage:
  python coach-graph/graph.py --profile local-safe-audit
  python coach-graph/graph.py --profile local-safe-audit --dry-run --json
  HOOT_GRAPH_AUTO_APPROVE=1 python coach-graph/graph.py --profile local-safe-audit
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from runner import invoke_graph


def main() -> int:
    parser = argparse.ArgumentParser(description="Run HOOT launch-approval graph")
    parser.add_argument("--profile", required=True, help="Profile ID from profiles/*.md")
    parser.add_argument("--dry-run", action="store_true", help="Score + approve without live launch")
    parser.add_argument("--auto-approve", action="store_true", help="Skip stdin approval prompt")
    parser.add_argument("--json", action="store_true", help="Print result as JSON")
    args = parser.parse_args()

    result = invoke_graph(
        args.profile,
        dry_run_mode=args.dry_run,
        auto_approve=args.auto_approve
        or __import__("os").environ.get("HOOT_GRAPH_AUTO_APPROVE", "").lower() in ("1", "true", "yes"),
    )
    final = result.get("state") or {}

    if args.json:
        print(json.dumps(result, indent=2, default=str))
    else:
        if result.get("error"):
            print(f"Graph failed: {result['error']}")
        elif result.get("launched"):
            print(f"Launched {args.profile} via coach-graph")
        elif args.dry_run:
            print(f"Dry-run OK for {args.profile} (score={final.get('score')})")
        else:
            print("Graph completed without launch")

    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())