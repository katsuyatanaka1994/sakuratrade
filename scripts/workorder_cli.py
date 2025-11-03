#!/usr/bin/env python3
"""codex-docsync workorder CLI.

Subcommands
-----------
ready     Read plan.md and propagate plan_snapshot_id / TASKS into workorder.md
validate  Verify workorder.md AUTO sections remain in sync with plan.md
pr        Create or update the Implementation Draft PR on docs-sync/workorder
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import shutil
import subprocess
from pathlib import Path
from typing import Any, Iterable, List, Sequence

from scripts import docsync_utils, plan_cli, workorder_guard
from scripts.docsync_utils import (
    extract_auto_block,
    render_yaml_block,
    replace_auto_block,
)

ROOT = Path(__file__).resolve().parent.parent

PLAN_PATH = docsync_utils.ROOT / "docs" / "agile" / "plan.md"
WORKORDER_PATH = docsync_utils.ROOT / "docs" / "agile" / "workorder.md"
WORKORDER_SYNC_PLAN_PATH = docsync_utils.ROOT / "workorder_sync_plan.json"
AUDIT_LOG_RELATIVE_PATH = Path("docs") / "agile" / "workorder-audit.log"

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
    "docs/agile/workorder-audit.log",
]

DEFAULT_BASE_BRANCH = "docs-sync/plan"
DEFAULT_HEAD_BRANCH = "docs-sync/workorder"
DEFAULT_ALLOWED_BASE_BRANCHES = [DEFAULT_BASE_BRANCH]
DEFAULT_ALLOWED_HEAD_BRANCHES = [DEFAULT_HEAD_BRANCH]
COMMIT_MESSAGE = "chore(workorder): sync workorder AUTO sections"
PR_TITLE = "[workorder-ready] docs: sync workorder auto sections"


def _relative_path(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def _audit_log_path() -> Path:
    return ROOT / AUDIT_LOG_RELATIVE_PATH


def _target_files() -> list[str]:
    return [
        _relative_path(WORKORDER_PATH),
        _relative_path(WORKORDER_SYNC_PLAN_PATH),
        _relative_path(_audit_log_path()),
    ]


def _pr_body_path() -> Path:
    return ROOT / "tmp" / "workorder_pr_body.md"


def _run(cmd: Sequence[str], *, check: bool = True, capture_output: bool = False) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        list(cmd),
        cwd=ROOT,
        check=check,
        text=True,
        capture_output=capture_output,
    )


def _git_status(paths: Sequence[str] | None = None) -> list[tuple[str, str]]:
    cmd: list[str] = ["git", "status", "--porcelain=1"]
    if paths:
        cmd.append("--")
        cmd.extend(paths)
    completed = _run(cmd, capture_output=True)
    entries: list[tuple[str, str]] = []
    for line in completed.stdout.splitlines():
        if not line.strip():
            continue
        status = line[:2]
        path = line[3:].strip()
        entries.append((status, path))
    return entries


def _ensure_clean_tree(allowed_relative_paths: Sequence[str], *, allow_dirty: bool) -> None:
    if allow_dirty:
        return
    allowed = set(allowed_relative_paths)
    for status, path in _git_status():
        if path not in allowed:
            raise SystemExit(
                "作業ツリーに workorder 以外の変更があります。"
                " `git status` で確認し、別途コミットするか --allow-dirty オプションを使用してください。"
            )


def _evaluate_guard(
    allowed: Sequence[str],
    blocked: Sequence[str],
    limits: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]]:
    stats = workorder_guard.collect_diff_stats()
    evaluation = workorder_guard.evaluate_guard(stats, allowed, blocked, limits)
    return evaluation, stats


def _format_guard_failure(evaluation: dict[str, Any], stats: dict[str, Any], limits: dict[str, Any]) -> str:
    status = evaluation.get("status", "unknown")
    if status == "disallowed":
        files = ", ".join(evaluation.get("disallowed_files") or []) or "該当ファイルなし"
        return f"ガード失敗: 許可されていないパスを検出しました ({files})。"
    if status == "blocked_paths":
        files = ", ".join(evaluation.get("blocked_files") or []) or "該当ファイルなし"
        return f"ガード失敗: 禁止パスに触れています ({files})。"
    if status == "limit_exceeded":
        reasons: list[str] = []
        for item in evaluation.get("file_over_limit") or []:
            reasons.append(f"{item.get('path')} {item.get('total')}/{item.get('limit')}")
        if evaluation.get("total_over_limit"):
            total_lines = stats.get("total_lines", 0)
            total_limit = limits.get("max_total_changed_lines") or (
                (limits.get("max_changed_lines") or {}).get("per_pr") if isinstance(limits, dict) else None
            )
            reasons.append(f"総変更行数 {total_lines}/{total_limit}")
        if evaluation.get("file_count_over_limit"):
            file_count = stats.get("file_count", 0)
            limit_files = limits.get("max_changed_files")
            reasons.append(f"変更ファイル数 {file_count}/{limit_files}")
        details = "; ".join(reasons) or "閾値超過"
        return f"ガード失敗: 上限を超過しました ({details})。"
    return f"ガード失敗: status={status}"


def _render_pr_body(
    *,
    trigger: str,
    snapshot: str,
    task_ids: Sequence[str],
    tasks: Sequence[dict[str, Any]],
    source_ref: str | None = None,
) -> str:
    lines = ["Automated workorder sync run.", "", f"- Trigger: {trigger}"]
    if source_ref:
        lines.append(f"- Source ref: `{source_ref}`")
    if snapshot:
        lines.append(f"- plan_snapshot_id: {snapshot}")
    if task_ids:
        joined = ", ".join(task_ids)
        lines.append(f"- Tasks: {joined}")
    if tasks:
        lines.append("")
        lines.append("## Task details")
        for task in tasks:
            task_id = task.get("id", "(no-id)")
            refs = ", ".join(task.get("refs") or []) or "-"
            outputs = ", ".join(task.get("outputs") or []) or "-"
            lines.append(f"- {task_id}: refs=[{refs}] outputs=[{outputs}]")
    return "\n".join(lines)


def _join_strings(items: Iterable[object], sep: str = ", ") -> str:
    clean: List[str] = [value for value in items if isinstance(value, str) and value]
    clean.sort()
    return sep.join(clean)


def _split_patterns(raw: str | None) -> list[str]:
    if not raw:
        return []
    return [item.strip() for item in raw.split(",") if item.strip()]


def _load_allowed_branches(env_name: str, default: Sequence[str]) -> list[str]:
    raw = os.environ.get(env_name)
    if not raw:
        return list(default)
    values = [item.strip() for item in raw.split(",") if item.strip()]
    return values or list(default)


def _assert_allowed_branch(role: str, branch: str, allowed: Sequence[str]) -> None:
    if branch in allowed:
        return
    joined = ", ".join(allowed)
    raise SystemExit(
        f"{role} ブランチ '{branch}' は許可されていません。許可ブランチ: {joined}"
    )


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

    audit_path = _audit_log_path()
    audit_path.parent.mkdir(parents=True, exist_ok=True)
    if not audit_path.exists():
        audit_path.write_text(
            json.dumps({"schema_version": 1, "note": "workorder-ready audit log (JSON Lines)"}, ensure_ascii=False)
            + "\n",
            encoding="utf-8",
        )


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
        raise SystemExit("workorder_sync_plan.json が見つかりません。先に ready を実行してください。")

    data = json.loads(WORKORDER_SYNC_PLAN_PATH.read_text(encoding="utf-8"))
    task_ids = [task_id for task_id in data.get("task_ids") or [] if isinstance(task_id, str) and task_id]
    if not task_ids:
        print("Plan 由来のタスクがありません。Implementation Draft PR は不要です。")
        return

    snapshot = data.get("plan_snapshot_id", "")
    tasks = data.get("tasks") or []
    allowed_patterns = list(data.get("allowed_paths") or [])
    blocked_patterns = list(data.get("blocked_paths") or [])
    limits = data.get("limits") or {}

    target_files = _target_files()
    if not allowed_patterns:
        allowed_patterns = target_files

    _ensure_clean_tree(target_files, allow_dirty=getattr(args, "allow_dirty", False))

    evaluation, stats = _evaluate_guard(allowed_patterns, blocked_patterns, limits)
    status = evaluation.get("status")
    if status == "no_changes":
        print("Implementation Draft PR に含める差分はありませんでした。")
        return
    if status == "disallowed":
        message = _format_guard_failure(evaluation, stats, limits)
        print(message)
        print("許可パス外の変更が含まれるため、自動実装は No-Op としてスキップします。")
        return
    if status != "ok":
        message = _format_guard_failure(evaluation, stats, limits)
        raise SystemExit(message)

    if not _git_status(paths=target_files):
        print("Implementation Draft PR に含める差分がありませんでした。")
        return

    base = getattr(args, "base", DEFAULT_BASE_BRANCH) or DEFAULT_BASE_BRANCH
    head = getattr(args, "head", DEFAULT_HEAD_BRANCH) or DEFAULT_HEAD_BRANCH

    allowed_bases = _load_allowed_branches("WORKORDER_ALLOWED_BASES", DEFAULT_ALLOWED_BASE_BRANCHES)
    allowed_heads = _load_allowed_branches("WORKORDER_ALLOWED_HEADS", DEFAULT_ALLOWED_HEAD_BRANCHES)
    _assert_allowed_branch("Base", base, allowed_bases)
    _assert_allowed_branch("Head", head, allowed_heads)

    try:
        _run(["git", "rev-parse", "--verify", "HEAD"])
    except subprocess.CalledProcessError as exc:
        raise SystemExit("git リポジトリが初期化されていないか、コミットが存在しません。") from exc

    fetch_result = _run(["git", "fetch", "origin", base], check=False)
    if fetch_result.returncode != 0:
        print(
            f"警告: origin/{base} の取得に失敗しました (code={fetch_result.returncode})。ローカル {base} を使用します。"
        )

    try:
        _run(["git", "switch", "-C", head, base])
    except subprocess.CalledProcessError as exc:
        raise SystemExit(f"git switch -C {head} {base} に失敗しました。") from exc

    try:
        _run(["git", "add", *target_files])
    except subprocess.CalledProcessError as exc:
        raise SystemExit("git add に失敗しました。") from exc

    if _run(["git", "diff", "--cached", "--quiet"], check=False).returncode == 0:
        print("コミット対象の差分がありません。")
        return

    try:
        _run(["git", "commit", "-m", COMMIT_MESSAGE])
    except subprocess.CalledProcessError as exc:
        raise SystemExit("git commit に失敗しました。") from exc

    body = _render_pr_body(
        trigger="cli",
        snapshot=snapshot,
        task_ids=task_ids,
        tasks=tasks,
    )
    body_path = _pr_body_path()
    body_path.parent.mkdir(parents=True, exist_ok=True)
    body_path.write_text(body + "\n", encoding="utf-8")

    print("Implementation Draft PR を準備しました。")
    print(f"- branch: {head}")
    if snapshot:
        print(f"- plan_snapshot_id: {snapshot}")
    if task_ids:
        print(f"- tasks ({len(task_ids)}): {', '.join(task_ids)}")
    print(f"- body: {body_path.relative_to(ROOT)}")

    no_push = getattr(args, "no_push", False)
    no_pr = getattr(args, "no_pr", False)

    if no_push:
        print(f"git push --force-with-lease origin {head} を実行してリモートを更新してください。")
    else:
        push_result = _run(["git", "push", "--force-with-lease", "origin", head], check=False)
        if push_result.returncode != 0:
            raise SystemExit(f"git push が失敗しました (code={push_result.returncode})。")
        print(f"Pushed {head} to origin.")

    if no_pr or no_push:
        print("PR の作成/更新は以下のコマンドで実行できます:")
        print(f"  gh pr create --draft --title '{PR_TITLE}' --body-file {body_path} --base {base} --head {head}")
        return

    if not shutil.which("gh"):
        print("gh コマンドが見つかりません。以下のコマンドを実行して PR を作成してください:")
        print(f"  gh pr create --draft --title '{PR_TITLE}' --body-file {body_path} --base {base} --head {head}")
        return

    view_result = _run(["gh", "pr", "view", head], check=False)
    if view_result.returncode == 0:
        try:
            _run(
                [
                    "gh",
                    "pr",
                    "edit",
                    head,
                    "--title",
                    PR_TITLE,
                    "--body-file",
                    str(body_path),
                    "--base",
                    base,
                ]
            )
        except subprocess.CalledProcessError as exc:
            raise SystemExit("gh pr edit に失敗しました。") from exc
        print("既存の Implementation Draft PR を更新しました。")
    else:
        try:
            _run(
                [
                    "gh",
                    "pr",
                    "create",
                    "--draft",
                    "--title",
                    PR_TITLE,
                    "--body-file",
                    str(body_path),
                    "--base",
                    base,
                    "--head",
                    head,
                ]
            )
        except subprocess.CalledProcessError as exc:
            raise SystemExit("gh pr create に失敗しました。") from exc
        print("Implementation Draft PR を新規作成しました。")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="codex-docsync workorder CLI")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("ready", help="Update workorder.md AUTO sections based on plan.md")
    sub.add_parser("validate", help="Validate workorder.md consistency with plan.md")
    pr_parser = sub.add_parser(
        "pr",
        help="Create or update the Implementation Draft PR on docs-sync/workorder",
    )
    pr_parser.add_argument(
        "--base",
        default=DEFAULT_BASE_BRANCH,
        help=f"Base branch for the PR (default: {DEFAULT_BASE_BRANCH})",
    )
    pr_parser.add_argument(
        "--head",
        default=DEFAULT_HEAD_BRANCH,
        help=f"Implementation branch name (default: {DEFAULT_HEAD_BRANCH})",
    )
    pr_parser.add_argument(
        "--no-push",
        action="store_true",
        help="Skip git push (useful for local dry runs)",
    )
    pr_parser.add_argument(
        "--no-pr",
        action="store_true",
        help="Skip GitHub PR creation/update",
    )
    pr_parser.add_argument(
        "--allow-dirty",
        action="store_true",
        help="Allow other working tree changes (advanced)",
    )

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
