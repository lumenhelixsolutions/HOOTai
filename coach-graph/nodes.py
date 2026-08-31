"""LangGraph nodes for HOOT launch-approval graph."""

from __future__ import annotations

import os
from typing import TypedDict

from h00t_client import (
    append_memory_evidence,
    dry_run_launch,
    fetch_scan,
    launch_profile,
    profile_score,
)

MIN_SCORE = int(os.environ.get("HOOT_GRAPH_MIN_SCORE", "80"))


class GraphState(TypedDict, total=False):
    profile_id: str
    scan: dict
    score: int
    min_score: int
    profile_tier: str
    graph_variant: str
    approved: bool
    auto_approve: bool
    dry_run_mode: bool
    launch_preview: dict
    launch_result: dict
    remember_result: dict
    error: str | None


def node_scan(state: GraphState) -> GraphState:
    try:
        return {**state, "scan": fetch_scan(), "error": None}
    except Exception as exc:  # noqa: BLE001
        return {**state, "error": str(exc)}


def node_score(state: GraphState) -> GraphState:
    profile_id = state.get("profile_id") or ""
    if not profile_id:
        return {**state, "error": "profile_id required"}
    score = profile_score(profile_id)
    min_required = int(state.get("min_score") or MIN_SCORE)
    if score < min_required:
        return {**state, "score": score, "error": f"score {score} < {min_required}"}
    try:
        preview = dry_run_launch(profile_id)
        return {**state, "score": score, "launch_preview": preview, "error": None}
    except Exception as exc:  # noqa: BLE001
        return {**state, "score": score, "error": str(exc)}


def node_approve(state: GraphState) -> GraphState:
    if state.get("error"):
        return state
    auto = state.get("auto_approve") or os.environ.get("HOOT_GRAPH_AUTO_APPROVE", "").lower() in (
        "1",
        "true",
        "yes",
    )
    if auto:
        return {**state, "approved": True}
    profile_id = state.get("profile_id", "")
    score = state.get("score", 0)
    print(f"\n[approve] Launch profile '{profile_id}'? score={score} (y/N): ", end="", flush=True)
    answer = input().strip().lower()
    if answer not in ("y", "yes"):
        return {**state, "approved": False, "error": "human rejected launch"}
    return {**state, "approved": True}


def node_launch(state: GraphState) -> GraphState:
    if state.get("error") or not state.get("approved"):
        return state
    profile_id = state.get("profile_id") or ""
    try:
        if state.get("dry_run_mode"):
            preview = state.get("launch_preview") or dry_run_launch(profile_id)
            return {
                **state,
                "launch_result": {**preview, "launched": False, "dryRun": True},
                "error": None,
            }
        result = launch_profile(profile_id)
        if result.get("needsConfirmation"):
            return {**state, "error": "launch needs confirmation", "launch_result": result}
        if not result.get("launched"):
            return {**state, "error": result.get("message") or "launch blocked", "launch_result": result}
        return {**state, "launch_result": result, "error": None}
    except Exception as exc:  # noqa: BLE001
        return {**state, "error": str(exc)}


def node_remember(state: GraphState) -> GraphState:
    if state.get("error") or state.get("dry_run_mode"):
        return state
    profile_id = state.get("profile_id") or ""
    try:
        mem = append_memory_evidence(
            profile_id,
            "observed-run",
            "coach-graph launch approval completed",
        )
        return {**state, "remember_result": mem, "error": None}
    except Exception as exc:  # noqa: BLE001
        return {**state, "error": str(exc)}