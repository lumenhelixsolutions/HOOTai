"""Shared LangGraph invoke helpers for CLI and HTTP sidecar."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from langgraph.graph import END, StateGraph

from nodes import (
    GraphState,
    node_approve,
    node_launch,
    node_remember,
    node_scan,
    node_score,
)

ROOT = Path(__file__).resolve().parent


def load_graph_profiles() -> dict[str, Any]:
    path = ROOT / "graph_profiles.json"
    if not path.exists():
        return {"version": 1, "defaultMinScore": 80, "profiles": {}, "graphs": {}}
    return json.loads(path.read_text(encoding="utf-8"))


def resolve_profile_config(profile_id: str) -> dict[str, Any]:
    doc = load_graph_profiles()
    profiles = doc.get("profiles") or {}
    cfg = profiles.get(profile_id) or {}
    return {
        "profile_id": profile_id,
        "min_score": int(cfg.get("minScore") or doc.get("defaultMinScore") or 80),
        "tier": cfg.get("tier") or "default",
        "graph": cfg.get("graph") or "hoot-launch-approval",
    }


def should_continue_after_score(state: GraphState) -> str:
    if state.get("error"):
        return "end"
    return "approve"


def should_continue_after_approve(state: GraphState) -> str:
    if state.get("error") or not state.get("approved"):
        return "end"
    return "launch"


def should_continue_after_launch(state: GraphState) -> str:
    if state.get("error"):
        return "end"
    return "remember"


def build_graph():
    graph = StateGraph(GraphState)
    graph.add_node("scan", node_scan)
    graph.add_node("score", node_score)
    graph.add_node("approve", node_approve)
    graph.add_node("launch", node_launch)
    graph.add_node("remember", node_remember)

    graph.set_entry_point("scan")
    graph.add_edge("scan", "score")
    graph.add_conditional_edges("score", should_continue_after_score, {"approve": "approve", "end": END})
    graph.add_conditional_edges("approve", should_continue_after_approve, {"launch": "launch", "end": END})
    graph.add_conditional_edges("launch", should_continue_after_launch, {"remember": "remember", "end": END})
    graph.add_edge("remember", END)
    return graph.compile()


def invoke_graph(
    profile_id: str,
    *,
    dry_run_mode: bool = False,
    auto_approve: bool = False,
    min_score: int | None = None,
) -> dict[str, Any]:
    cfg = resolve_profile_config(profile_id)
    initial: GraphState = {
        "profile_id": profile_id,
        "approved": False,
        "dry_run_mode": dry_run_mode,
        "auto_approve": auto_approve,
        "min_score": min_score if min_score is not None else cfg["min_score"],
        "graph_variant": cfg["graph"],
        "profile_tier": cfg["tier"],
    }
    app = build_graph()
    final = app.invoke(initial)
    return {
        "ok": not final.get("error"),
        "profile_id": profile_id,
        "config": cfg,
        "state": final,
        "error": final.get("error"),
        "launched": bool((final.get("launch_result") or {}).get("launched")),
        "dry_run_mode": dry_run_mode,
    }