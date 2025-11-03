#!/usr/bin/env python3
"""codex-docsync workorder CLI.

Subcommands
-----------
ready     Read plan.md and propagate plan_snapshot_id / TASKS into workorder.md
validate  Verify workorder.md AUTO sections remain in sync with plan.md
pr        (Stub) Show instructions for preparing the Implementation Draft PR
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
from pathlib import Path
from typing import Any, Iterable, List

from scripts import plan_cli
from scripts.docsync_utils import (
    ROOT as PROJECT_ROOT,
)
from scripts.docsync_utils import (
    extract_auto_block,
    render_yaml_block,
    replace_auto_block,
)

ROOT = Path(__file__).resolve().parent.parent

PLAN_PATH = PROJECT_ROOT / "docs" / "agile" / "plan.md"
WORKORDER_PATH = PROJECT_ROOT / "docs" / "agile" / "workorder.md"
WORKORDER_SYNC_PLAN_PATH = PROJECT_ROOT / "workorder_sync_plan.json"

DEFAULT_TASK_LINE_LIMIT = 80
DEFAULT_PR_LINE_LIMIT = 120
DEFAULT_FILE_LINE_LIMIT = 80
DEFAULT_TOTAL_LINE_LIMIT = 180
DEFAULT_LINES_PER_ITER = 60
DEFAULT_MAX_ITERATIONS = 3
DEFAULT_MAX_CHANGED_FILES = 6
DEFAULT_MAX_OPEN_AUTOMATION_PRS = 2

DEFAULT_BLOCKED_PATTERNS = [
    "alembic/**",
    "infra/**",
    "migrations/**",
]

DEFAULT_DOC_ALLOWED_PATTERNS = [
    "docs/agile/workorder.md",
    "workorder_sync_plan.json",
]


def _join_strings(items: Iterable[object], sep: str = ", ") -> str:
    clean: List[str] = [value for value in items if isinstance(value, str) and value]
    clean.sort()
    return sep.join(clean)


def _split_patterns(raw: str | None) -> list[str]:
    if not raw:
        return []
    return [item.strip() for item in raw.split(",") if item.strip()]


def _safe_int(value: str | None, default: int, *, env_name: str) -> int:
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        print(f"[workorder-cli] Invalid value for {env_name}={value!r}; falling back to {default}")
        return default


def _normalize_dir_glob(path: str) -> str:
    normalized = path.strip().replace("\\", "/")
    if not normalized:
        return ""
    if normalized.endswith("/**") or "*" in normalized:
        return normalized
    if "." in Path(normalized).name:
        return normalized
    return f"{normalized.rstrip('/')}/**"


def _load_allowed_paths(tasks: list[dict[str, Any]]) -> list[str]:
    patterns = set(_split_patterns(os.environ.get("WORKORDER_ALLOWED_PATHS")))
    for task in tasks:
        for output in task.get("outputs", []) or []:
            normalized = _normalize_dir_glob(str(output))
            if normalized:
                patterns.add(normalized)
    patterns.update(DEFAULT_DOC_ALLOWED_PATTERNS)
    return sorted(patterns)


def _load_blocked_paths() -> list[str]:
    patterns = _split_patterns(os.environ.get("WORKORDER_BLOCKED_PATHS"))
    return patterns or DEFAULT_BLOCKED_PATTERNS


def _load_limits() -> dict[str, Any]:
    per_task = _safe_int(
        os.environ.get("WORKORDER_MAX_TASK_LINES"),
        DEFAULT_TASK_LINE_LIMIT,
        env_name="WORKORDER_MAX_TASK_LINES",
    )
    per_pr = _safe_int(
        os.environ.get("WORKORDER_MAX_PR_LINES"),
        DEFAULT_PR_LINE_LIMIT,
        env_name="WORKORDER_MAX_PR_LINES",
    )
    per_file = _safe_int(
        os.environ.get("WORKORDER_MAX_FILE_LINES"),
        DEFAULT_FILE_LINE_LIMIT,
        env_name="WORKORDER_MAX_FILE_LINES",
    )
    total_lines = _safe_int(
        os.environ.get("WORKORDER_MAX_TOTAL_LINES"),
        DEFAULT_TOTAL_LINE_LIMIT,
        env_name="WORKORDER_MAX_TOTAL_LINES",
    )
    lines_per_iter = _safe_int(
        os.environ.get("WORKORDER_MAX_LINES_PER_ITER"),
        DEFAULT_LINES_PER_ITER,
        env_name="WORKORDER_MAX_LINES_PER_ITER",
    )
    max_iterations = _safe_int(
        os.environ.get("WORKORDER_MAX_ITERATIONS"),
        DEFAULT_MAX_ITERATIONS,
        env_name="WORKORDER_MAX_ITERATIONS",
    )
    max_files = _safe_int(
        os.environ.get("WORKORDER_MAX_CHANGED_FILES"),
        DEFAULT_MAX_CHANGED_FILES,
        env_name="WORKORDER_MAX_CHANGED_FILES",
    )
    max_auto_prs = _safe_int(
        os.environ.get("WORKORDER_MAX_AUTO_PRS"),
        DEFAULT_MAX_OPEN_AUTOMATION_PRS,
        env_name="WORKORDER_MAX_AUTO_PRS",
    )

    return {
        "max_changed_lines": {
            "per_task": per_task,
            "per_pr": per_pr,
            "per_file": per_file,
        },
        "max_changed_lines_per_iter": lines_per_iter,
        "max_total_changed_lines": total_lines,
        "max_changed_files": max_files,
        "max_open_automation_prs": max_auto_prs,
        "retry_guard": {
            "max_iterations": max_iterations,
            "stop_reasons": ["checks_green", "no_patch", "limit_exceeded"],
        },
    }


def _build_plan_links(snapshot: str, tasks: list[dict[str, Any]]) -> dict[str, Any]:
    minimal_tasks: list[dict[str, Any]] = []
    for task in tasks:
        minimal_tasks.append(
            {
                "id": task.get("id"),
                "refs": task.get("refs", []),
                "outputs": task.get("outputs", []),
            }
        )
    try:
        doc_path = str(PLAN_PATH.relative_to(ROOT))
    except ValueError:
        doc_path = str(PLAN_PATH)
    return {
        "plan_snapshot_id": snapshot,
        "sources": [
            {
                "doc": doc_path,
                "sections": ["plan.meta", "plan.tasks"],
            }
        ],
        "tasks": minimal_tasks,
    }


def _extract_plan_snapshot_id(plan_text: str) -> str:
    try:
        meta_block = extract_auto_block(plan_text, "plan.meta")
    except ValueError as exc:
        raise SystemExit(str(exc))
    match = re.search(r"-\s*plan_snapshot_id:\s*(\S+)", meta_block)
    if not match:
        raise SystemExit("plan.meta に plan_snapshot_id が見つかりません。")
    return match.group(1).strip()


def _load_plan_tasks_from_preflight() -> list[dict[str, Any]]:
    if not plan_cli.DOC_SYNC_PLAN_PATH.exists():
        raise SystemExit(
            "doc_sync_plan.json が見つかりません。`python3 scripts/plan_cli.py preflight` を実行してください。"
        )
    data = plan_cli.load_preflight()
    tasks = plan_cli.build_tasks(data)
    return [dict(task) for task in tasks]


def _load_plan_data() -> tuple[str, list[dict[str, Any]]]:
    if not PLAN_PATH.exists():
        raise SystemExit("docs/agile/plan.md が見つかりません。")
    plan_text = PLAN_PATH.read_text(encoding="utf-8")
    snapshot = _extract_plan_snapshot_id(plan_text)
    tasks_list = _load_plan_tasks_from_preflight()
    return snapshot, tasks_list


def _ordered_task(task: dict[str, Any]) -> dict[str, Any]:
    ordered: dict[str, Any] = {}
    preferred_order = [
        "id",
        "refs",
        "outputs",
        "acceptance",
        "gate",
        "deps",
        "owner",
        "risk",
        "rollback",
        "notes",
    ]
    for key in preferred_order:
        if key in task:
            ordered[key] = task[key]
    for key, value in task.items():
        if key not in ordered:
            ordered[key] = value
    return ordered


def cmd_ready(args: argparse.Namespace) -> None:
    snapshot, plan_tasks = _load_plan_data()

    ordered_tasks = [_ordered_task(task) for task in plan_tasks]
    now = dt.datetime.now(dt.timezone.utc).astimezone()

    limits = _load_limits()
    allowed_paths = _load_allowed_paths(ordered_tasks)
    blocked_paths = _load_blocked_paths()
    plan_links = _build_plan_links(snapshot, ordered_tasks)

    meta_block = render_yaml_block(
        [
            {"plan_snapshot_id": snapshot},
            {"Doc ID": "workorder"},
            {"Updated at": now.isoformat(timespec="seconds")},
            {"Tasks": ordered_tasks},
        ]
    )

    limits_block = render_yaml_block(limits)
    allowed_block = render_yaml_block(allowed_paths)
    blocked_block = render_yaml_block(blocked_paths)
    plan_links_block = render_yaml_block(plan_links)

    if not WORKORDER_PATH.exists():
        raise SystemExit("docs/agile/workorder.md が見つかりません。")
    original = WORKORDER_PATH.read_text(encoding="utf-8")
    updated = replace_auto_block(original, "workorder.meta", meta_block)
    updated = replace_auto_block(updated, "workorder.limits", limits_block)
    updated = replace_auto_block(updated, "workorder.allowed_paths", allowed_block)
    updated = replace_auto_block(updated, "workorder.blocked_paths", blocked_block)
    updated = replace_auto_block(updated, "workorder.plan_links", plan_links_block)

    if updated != original:
        WORKORDER_PATH.write_text(updated, encoding="utf-8")
        print(f"Updated {WORKORDER_PATH.relative_to(ROOT)}")
    else:
        print("workorder.md に差分はありませんでした。")

    summary = {
        "plan_snapshot_id": snapshot,
        "task_ids": [
            task_id for task_id in (task.get("id") for task in ordered_tasks) if isinstance(task_id, str) and task_id
        ],
        "tasks": ordered_tasks,
        "limits": limits,
        "allowed_paths": allowed_paths,
        "blocked_paths": blocked_paths,
        "plan_links": plan_links,
    }
    WORKORDER_SYNC_PLAN_PATH.write_text(
        json.dumps(summary, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Saved {WORKORDER_SYNC_PLAN_PATH.relative_to(ROOT)}")


def cmd_validate(args: argparse.Namespace) -> None:
    snapshot, plan_tasks = _load_plan_data()
    plan_task_ids: list[str] = [
        task_id for task_id in (task.get("id") for task in plan_tasks) if isinstance(task_id, str) and task_id
    ]

    if not WORKORDER_PATH.exists():
        raise SystemExit("docs/agile/workorder.md が見つかりません。")

    text = WORKORDER_PATH.read_text(encoding="utf-8")
    errors: list[str] = []

    try:
        workorder_block = extract_auto_block(text, "workorder.meta")
    except ValueError:
        errors.append("::error file=docs/agile/workorder.md::AUTO セクション workorder.meta が見つかりません。")
        workorder_block = ""

    snapshot_in_workorder: str | None = None
    if workorder_block:
        match = re.search(r"-\s*plan_snapshot_id:\s*(\S+)", workorder_block)
        if match:
            snapshot_in_workorder = match.group(1).strip()
        else:
            errors.append("::error file=docs/agile/workorder.md::plan_snapshot_id が設定されていません。")
    else:
        snapshot_in_workorder = None

    if snapshot_in_workorder and snapshot_in_workorder != snapshot:
        errors.append("::error file=docs/agile/workorder.md::plan_snapshot_id が plan.md と一致しません。")

    workorder_ids = [match.group(1).strip() for match in re.finditer(r"^\s+id:\s*(.+)$", workorder_block, re.MULTILINE)]
    missing = sorted({task_id for task_id in plan_task_ids if task_id not in workorder_ids})
    if missing:
        details = _join_strings(missing)
        errors.append(f"::error file=docs/agile/workorder.md::Tasks に Plan のタスクが不足しています: {details}")

    if errors:
        for message in errors:
            print(message)
        raise SystemExit(1)

    print("docs/agile/workorder.md: OK")


def cmd_pr(args: argparse.Namespace) -> None:
    if not WORKORDER_SYNC_PLAN_PATH.exists():
        print("workorder_sync_plan.json が見つかりません。先に ready を実行してください。")
        return

    data = json.loads(WORKORDER_SYNC_PLAN_PATH.read_text(encoding="utf-8"))
    task_ids = data.get("task_ids") or []
    if not task_ids:
        print("Plan 由来のタスクがありません。Implementation Draft PR は不要です。")
        return

    snapshot = data.get("plan_snapshot_id", "")
    tasks = data.get("tasks") or []

    print("Implementation Draft PR を作成する前に次を確認してください:")
    print(f"- plan_snapshot_id: {snapshot}")
    joined_ids = _join_strings(task_ids)
    print(f"- タスク数: {len(task_ids)} ({joined_ids})")
    if tasks:
        print("- タスク要約:")
        for task in tasks:
            task_id = task.get("id", "(no-id)")
            refs = _join_strings(task.get("refs", [])) or "-"
            outputs = _join_strings(task.get("outputs", [])) or "-"
            print(f"    - {task_id} | refs: {refs} | outputs: {outputs}")

    print("\n推奨手順:")
    print("1. git checkout -B docs-sync/workorder")
    print("2. git add docs/agile/workorder.md workorder_sync_plan.json")
    print("3. git commit -m 'chore(workorder): sync implementation tasks'")
    print("4. git push --force-with-lease origin docs-sync/workorder")
    print(
        "5. gh pr create --draft --title '[workorder-ready] docs: sync workorder auto sections' "
        "--base <target> --head docs-sync/workorder"
    )
    print("   （既存PRがある場合は gh pr edit docs-sync/workorder で更新）")
    print("6. PR 本文に plan_snapshot_id とタスク一覧を貼り付ける")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="codex-docsync workorder CLI")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("ready", help="Update workorder.md AUTO sections based on plan.md")
    sub.add_parser("validate", help="Validate workorder.md consistency with plan.md")
    sub.add_parser("pr", help="(Stub) print instructions for PR creation")

    args = parser.parse_args(argv)

    if args.command == "ready":
        cmd_ready(args)
    elif args.command == "validate":
        cmd_validate(args)
    elif args.command == "pr":
        cmd_pr(args)
    else:  # pragma: no cover - argparse guards commands
        parser.error("Unknown command")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
