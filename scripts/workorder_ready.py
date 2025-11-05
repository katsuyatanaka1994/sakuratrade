#!/usr/bin/env python3
"""Helper invoked by workorder-ready reusable workflow.

This module replaces inline Python from the YAML workflow so that the
workflow file stays simple and free from indentation-sensitive blocks.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
from pathlib import Path
from typing import Iterable

from scripts import docsync_utils

ROOT = docsync_utils.ROOT


def _github_output() -> Path:
    output = os.environ.get("GITHUB_OUTPUT")
    if not output:
        raise SystemExit("GITHUB_OUTPUT not set")
    return Path(output)


def _write_outputs(**values: str) -> None:
    out = _github_output()
    with out.open("a", encoding="utf-8") as handle:
        for key, value in values.items():
            handle.write(f"{key}={value}\n")


def _load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def parse_guard(report_path: Path | None) -> dict[str, str]:
    status = "unknown"
    treated = "false"
    disallowed = ""
    limit_exceeded = "false"
    if report_path and report_path.is_file():
        data = _load_json(report_path)
        status = (data.get("status") or "unknown").strip() or "unknown"
        treated = "true" if data.get("treated_as_noop") else "false"
        disallowed = ",".join(data.get("disallowed_files") or [])
        over_limit = any(
            bool(data.get(key))
            for key in ("file_over_limit", "total_over_limit", "file_count_over_limit")
        )
        limit_exceeded = "true" if over_limit else "false"
    return {
        "status": status,
        "treated_as_noop": treated,
        "disallowed_files": disallowed,
        "limit_exceeded": limit_exceeded,
    }


def reset_disallowed(report_path: Path | None) -> None:
    if not report_path or not report_path.is_file():
        return
    data = _load_json(report_path)
    for item in data.get("disallowed_files") or []:
        if not item:
            continue
        subprocess.run(["git", "checkout", "--", item], check=False)


def render_workorder_body(
    snapshot: str,
    task_ids: Iterable[str],
    trigger: str,
    source_head: str,
) -> tuple[Path, str, str]:
    lines = ["Automated workorder sync run.", "", f"- Trigger: {trigger}"]
    if source_head:
        lines.append(f"- Source ref: `{source_head}`")
    if snapshot:
        lines.append(f"- plan_snapshot_id: {snapshot}")
    tasks_csv = ", ".join([tid for tid in task_ids if tid])
    if tasks_csv:
        lines.append(f"- Tasks: {tasks_csv}")
    body_path = Path("/tmp/workorder-body.txt")
    body_path.parent.mkdir(parents=True, exist_ok=True)
    body_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return body_path, snapshot, tasks_csv


def load_acceptance_summary(summary_path: Path) -> dict[str, str]:
    data = _load_json(summary_path)
    cwd = Path.cwd()
    try:
        rel_summary = str(summary_path.relative_to(cwd))
    except ValueError:
        rel_summary = str(summary_path)
    log_dir = data.get("log_dir") or ""
    if log_dir:
        log_path = cwd / log_dir
        try:
            rel_log = str(log_path.relative_to(cwd))
        except ValueError:
            rel_log = log_dir
    else:
        rel_log = ""
    return {
        "status": data.get("status", "unknown"),
        "summary_path": rel_summary,
        "failed_stage": data.get("failed_stage") or "",
        "failed_check": data.get("failed_check") or "",
        "failed_command": data.get("failed_command") or "",
        "log_dir": rel_log,
    }


def ensure_workorder_pr(body_path: Path, base: str, source_pr: str) -> dict[str, str]:
    head = "docs-sync/workorder"
    action = ""
    status = "skipped"
    pr_number = ""
    if not body_path.is_file():
        print("::warning::workorder-ready: PR body missing; skipped PR update")
        return {"status": status, "action": action, "pr_number": pr_number}
    status = "success"

    def run(cmd: list[str]):
        return subprocess.run(cmd, text=True, capture_output=True)

    list_cmd = ["gh", "pr", "list", "--head", head, "--state", "open", "--json", "number", "--limit", "1"]
    open_number = ""
    list_proc = run(list_cmd)
    if list_proc.returncode == 0 and list_proc.stdout.strip():
        try:
            data = json.loads(list_proc.stdout)
        except json.JSONDecodeError as error:
            print(f"::warning::gh pr list parse error: {error}")
        else:
            if data:
                open_number = str(data[0].get("number") or "")
    elif list_proc.stderr:
        print(f"::warning::gh pr list failed: {list_proc.stderr.strip()}")

    base_branch = base or "docs-sync/plan"
    if open_number:
        edit_cmd = [
            "gh",
            "pr",
            "edit",
            head,
            "--title",
            "[workorder-ready] docs: sync workorder auto sections",
            "--body-file",
            str(body_path),
            "--base",
            base_branch,
        ]
        edit_proc = run(edit_cmd)
        if edit_proc.returncode == 0:
            action = "edit"
            pr_number = open_number
        else:
            message = f"gh pr edit failed (code {edit_proc.returncode})"
            if edit_proc.stderr:
                message += f": {edit_proc.stderr.strip()}"
            print(f"::warning::{message}. Falling back to draft creation.")

    if action != "edit":
        create_cmd = [
            "gh",
            "pr",
            "create",
            "--draft",
            "--title",
            "[workorder-ready] docs: sync workorder auto sections",
            "--body-file",
            str(body_path),
            "--base",
            base_branch,
            "--head",
            head,
        ]
        create_proc = run(create_cmd)
        if create_proc.returncode == 0:
            action = "create"
            list_proc = run(list_cmd)
            if list_proc.returncode == 0 and list_proc.stdout.strip():
                try:
                    data = json.loads(list_proc.stdout)
                except json.JSONDecodeError as error:
                    print(f"::warning::gh pr list parse error after create: {error}")
                else:
                    if data:
                        pr_number = str(data[0].get("number") or pr_number)
        else:
            status = "error"
            message = f"gh pr create failed (code {create_proc.returncode})"
            if create_proc.stderr:
                message += f": {create_proc.stderr.strip()}"
            cmd = (
                "gh pr create --draft --title '[workorder-ready] docs: sync workorder auto sections' "
                f"--body-file {body_path} --base {base_branch} --head {head}"
            )
            print(
                '::warning::'
                f"{message}. Push is complete; rerun workorder-ready or execute \"{cmd}\" manually."
            )
    if action == "edit" and not pr_number:
        pr_number = open_number
    if not action:
        action = "skipped"
        status = "skipped"
    return {"status": status, "action": action, "pr_number": pr_number}


def main() -> int:
    parser = argparse.ArgumentParser(description='workorder-ready workflow helper')
    parser.add_argument('--guard-report', type=Path)
    parser.add_argument('--write-guard-outputs', action='store_true')
    parser.add_argument('--reset-disallowed', action='store_true')
    parser.add_argument('--plan-json', type=Path)
    parser.add_argument('--trigger', default='workorder-ready')
    parser.add_argument('--source-head', default='')
    parser.add_argument('--summary', type=Path)
    parser.add_argument('--ensure-pr', action='store_true')
    parser.add_argument('--body-path', type=Path)
    parser.add_argument('--base', default='')
    parser.add_argument('--source-pr', default='')
    args = parser.parse_args()

    if args.write_guard_outputs:
        outputs = parse_guard(args.guard_report)
        _write_outputs(**outputs)

    if args.reset_disallowed:
        reset_disallowed(args.guard_report)

    if args.plan_json and args.plan_json.is_file():
        data = _load_json(args.plan_json)
        snapshot = data.get('plan_snapshot_id', '')
        task_ids = [tid for tid in data.get('task_ids', []) if isinstance(tid, str)]
        body_path, snapshot_out, tasks_csv = render_workorder_body(
            snapshot,
            task_ids,
            args.trigger,
            args.source_head,
        )
        _write_outputs(body_path=str(body_path), snapshot=snapshot_out, tasks_csv=tasks_csv)

    if args.summary and args.summary.is_file():
        summary_outputs = load_acceptance_summary(args.summary)
        _write_outputs(**summary_outputs)

    if args.ensure_pr:
        if not args.body_path:
            raise SystemExit('--body-path is required when --ensure-pr is set')
        result = ensure_workorder_pr(args.body_path, args.base, args.source_pr)
        _write_outputs(**result)

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
