#!/usr/bin/env python3
"""Guard checks for workorder automation diffs.

Reads workorder_sync_plan.json for limit configuration, inspects the current git
index via ``git diff --numstat``, and enforces allow/block lists plus line/file
ceilings. Results are written to ``WORKORDER_RUN_REPORT`` (default
``tmp/workorder_limits_report.json``) for downstream workflow steps.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any, Sequence

ROOT = Path(__file__).resolve().parent.parent
WORKORDER_SYNC_PLAN_PATH = ROOT / "workorder_sync_plan.json"

DEFAULT_REPORT_PATH = ROOT / "tmp" / "workorder_limits_report.json"


def _split_patterns(raw: str | None) -> list[str]:
    if not raw:
        return []
    return [item.strip() for item in raw.split(",") if item.strip()]


def _matches_any(path: str, patterns: Sequence[str]) -> bool:
    from fnmatch import fnmatch

    normalized = path.replace("\\", "/")
    return any(fnmatch(normalized, pattern) for pattern in patterns)


def _collect_diff_stats(paths: Sequence[str] | None = None, diff_range: str | None = None) -> dict[str, Any]:
    cmd = ["git", "diff", "--numstat"]
    if diff_range:
        cmd.append(diff_range)
    if paths:
        cmd.append("--")
        cmd.extend(paths)
    completed = subprocess.run(
        cmd,
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    files: list[dict[str, Any]] = []
    total_lines = 0
    for line in completed.stdout.splitlines():
        parts = line.split("\t")
        if len(parts) < 3:
            continue
        added_raw, deleted_raw, path = parts[:3]
        try:
            added = int(added_raw) if added_raw != "-" else 0
        except ValueError:
            added = 0
        try:
            deleted = int(deleted_raw) if deleted_raw != "-" else 0
        except ValueError:
            deleted = 0
        total = added + deleted
        files.append({"path": path, "added": added, "deleted": deleted, "total": total})
        total_lines += total
    return {"files": files, "file_count": len(files), "total_lines": total_lines}


def collect_diff_stats(paths: Sequence[str] | None = None, diff_range: str | None = None) -> dict[str, Any]:
    """Public wrapper so other modules can reuse the diff parser."""

    return _collect_diff_stats(paths, diff_range)


def _load_config() -> dict[str, Any]:
    if not WORKORDER_SYNC_PLAN_PATH.exists():
        raise SystemExit(
            "workorder_sync_plan.json が見つかりません。"
            " `python3 -m scripts.workorder_cli ready` を先に実行してください。"
        )
    try:
        return json.loads(WORKORDER_SYNC_PLAN_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"workorder_sync_plan.json の読み込みに失敗しました: {exc}") from exc


def _resolve_run_report() -> Path:
    raw = os.environ.get("WORKORDER_RUN_REPORT")
    if raw:
        path = Path(raw)
        if not path.is_absolute():
            path = ROOT / path
        return path
    return DEFAULT_REPORT_PATH


def evaluate_guard(
    stats: dict[str, Any],
    allowed_patterns: Sequence[str],
    blocked_patterns: Sequence[str],
    limits: dict[str, Any],
) -> dict[str, Any]:
    files = stats.get("files", [])
    disallowed = [
        entry["path"] for entry in files if allowed_patterns and not _matches_any(entry["path"], allowed_patterns)
    ]
    blocked = [entry["path"] for entry in files if blocked_patterns and _matches_any(entry["path"], blocked_patterns)]

    max_changed = (limits.get("max_changed_lines") or {}) if isinstance(limits, dict) else {}
    per_file_limit = max_changed.get("per_file")
    file_over_limit: list[dict[str, Any]] = []
    if per_file_limit:
        for entry in files:
            if entry["total"] > per_file_limit:
                file_over_limit.append(
                    {
                        "path": entry["path"],
                        "total": entry["total"],
                        "limit": per_file_limit,
                    }
                )

    total_limit = limits.get("max_total_changed_lines") if isinstance(limits, dict) else None
    if not total_limit:
        total_limit = max_changed.get("per_pr") if isinstance(max_changed, dict) else None
    total_over_limit = bool(total_limit and stats.get("total_lines", 0) > total_limit)

    max_files = limits.get("max_changed_files") if isinstance(limits, dict) else None
    file_count_over_limit = bool(max_files and stats.get("file_count", 0) > max_files)

    status = "ok"
    if stats.get("file_count", 0) == 0:
        status = "no_changes"
    elif blocked:
        status = "blocked_paths"
    elif disallowed:
        status = "disallowed"
    elif file_over_limit or total_over_limit or file_count_over_limit:
        status = "limit_exceeded"

    return {
        "status": status,
        "disallowed_files": disallowed,
        "blocked_files": blocked,
        "file_over_limit": file_over_limit,
        "total_over_limit": total_over_limit,
        "file_count_over_limit": file_count_over_limit,
    }


def _write_report(payload: dict[str, Any]) -> None:
    report_path = _resolve_run_report()
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    config = _load_config()
    allowed_patterns = list(config.get("allowed_paths") or [])
    blocked_patterns = list(config.get("blocked_paths") or [])
    limits = config.get("limits") or {}

    diff_range = os.environ.get("WORKORDER_DIFF_RANGE")
    stats = collect_diff_stats(diff_range=diff_range)
    evaluation = evaluate_guard(stats, allowed_patterns, blocked_patterns, limits)

    report = {
        "status": evaluation["status"],
        "stats": stats,
        "limits": limits,
        "allowed_patterns": allowed_patterns,
        "blocked_patterns": blocked_patterns,
        "disallowed_files": evaluation["disallowed_files"],
        "blocked_files": evaluation["blocked_files"],
        "file_over_limit": evaluation["file_over_limit"],
        "total_over_limit": evaluation["total_over_limit"],
        "file_count_over_limit": evaluation["file_count_over_limit"],
        "no_op": evaluation["status"] == "no_changes",
        "treated_as_noop": evaluation["status"] in {"no_changes", "disallowed"},
    }
    _write_report(report)

    status = evaluation["status"]
    print(f"workorder guard status: {status}")
    if evaluation["disallowed_files"]:
        print("Disallowed files:", ", ".join(evaluation["disallowed_files"]))
    if evaluation["blocked_files"]:
        print("Blocked files:", ", ".join(evaluation["blocked_files"]))
    if evaluation["file_over_limit"]:
        for item in evaluation["file_over_limit"]:
            print(f"File limit exceeded: {item['path']} (total={item['total']} > limit={item['limit']})")
    if evaluation["total_over_limit"]:
        line_limit = limits.get("max_total_changed_lines") or (limits.get("max_changed_lines") or {}).get("per_pr")
        total_lines = stats.get("total_lines", 0)
        print(f"Total line limit exceeded: {total_lines} > {line_limit}")
    if evaluation["file_count_over_limit"]:
        print(f"File count limit exceeded: {stats.get('file_count', 0)} > {limits.get('max_changed_files')}")

    if status in {"ok", "no_changes", "disallowed"}:
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
