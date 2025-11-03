#!/usr/bin/env python3
"""Record audit metadata for workorder automation executions."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import subprocess
from pathlib import Path
from typing import Any, Dict, Optional

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_LOG_PATH = ROOT / "docs" / "agile" / "workorder-audit.log"
DEFAULT_REPORT_PATH = ROOT / "tmp" / "workorder_limits_report.json"
DEFAULT_SYNC_PLAN_PATH = ROOT / "workorder_sync_plan.json"


def _load_json(path: Path) -> Optional[dict[str, Any]]:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def _git_rev_parse(ref: str) -> Optional[str]:
    try:
        completed = subprocess.run(
            ["git", "rev-parse", ref],
            cwd=ROOT,
            check=True,
            text=True,
            capture_output=True,
        )
    except subprocess.CalledProcessError:
        return None
    return completed.stdout.strip() or None


def _git_is_dirty() -> bool:
    try:
        completed = subprocess.run(
            ["git", "status", "--porcelain=1"],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=True,
        )
    except subprocess.CalledProcessError:
        return False
    return bool(completed.stdout.strip())


def build_entry(args: argparse.Namespace) -> dict[str, Any]:
    now = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")

    report = _load_json(Path(args.report)) if args.report else None
    sync_plan = _load_json(Path(args.sync_plan)) if args.sync_plan else None

    guard: Dict[str, Any] = {}
    if report:
        guard = {
            "status": report.get("status"),
            "treated_as_noop": report.get("treated_as_noop"),
            "disallowed_files": report.get("disallowed_files") or [],
            "blocked_files": report.get("blocked_files") or [],
            "stats": report.get("stats") or {},
        }

    entry: dict[str, Any] = {
        "timestamp": now,
        "actor": args.actor or os.environ.get("GITHUB_ACTOR"),
        "trigger": args.trigger,
        "run": {
            "id": args.run_id,
            "number": args.run_number,
            "attempt": args.run_attempt,
            "url": args.run_url,
        },
        "source": {
            "pr": args.source_pr or None,
            "head": args.source_head or None,
        },
        "branches": {
            "base": args.pr_base,
            "head": args.head_branch,
        },
        "guard": guard,
        "plan_snapshot_id": None,
        "task_ids": [],
        "git": {
            "head": _git_rev_parse("HEAD"),
            "worktree_dirty": _git_is_dirty(),
        },
    }

    if sync_plan:
        entry["plan_snapshot_id"] = sync_plan.get("plan_snapshot_id")
        task_ids = [tid for tid in sync_plan.get("task_ids", []) if isinstance(tid, str)]
        entry["task_ids"] = task_ids
        entry["tasks"] = sync_plan.get("tasks") or []

    return entry


def append_entry(entry: dict[str, Any], log_path: Path) -> None:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry, ensure_ascii=False) + "\n")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Record workorder audit entry")
    parser.add_argument("--trigger", required=True)
    parser.add_argument("--run-id", default=os.environ.get("GITHUB_RUN_ID"))
    parser.add_argument("--run-number", default=os.environ.get("GITHUB_RUN_NUMBER"))
    parser.add_argument("--run-attempt", default=os.environ.get("GITHUB_RUN_ATTEMPT"))
    parser.add_argument(
        "--run-url",
        default=os.environ.get("GITHUB_SERVER_URL", "https://github.com")
        + f"/{os.environ.get('GITHUB_REPOSITORY', '')}/actions/runs/"
        + (os.environ.get("GITHUB_RUN_ID") or ""),
    )
    parser.add_argument("--actor", default=os.environ.get("GITHUB_ACTOR"))
    parser.add_argument("--source-pr", default="")
    parser.add_argument("--source-head", default="")
    parser.add_argument("--pr-base", default="docs-sync/plan")
    parser.add_argument("--head-branch", default="docs-sync/workorder")
    parser.add_argument("--report", default=str(DEFAULT_REPORT_PATH))
    parser.add_argument("--sync-plan", default=str(DEFAULT_SYNC_PLAN_PATH))
    parser.add_argument("--log", default=str(DEFAULT_LOG_PATH))
    parser.add_argument("--artifact", default="")
    parser.add_argument("--skip-append", action="store_true")
    args = parser.parse_args(argv)
    return args


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    entry = build_entry(args)

    artifact_path: Optional[Path] = None
    if args.artifact:
        artifact_path = Path(args.artifact)
        artifact_path.parent.mkdir(parents=True, exist_ok=True)
        artifact_path.write_text(json.dumps(entry, ensure_ascii=False) + "\n", encoding="utf-8")

    if not args.skip_append:
        append_entry(entry, Path(args.log))

    print(json.dumps(entry, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
