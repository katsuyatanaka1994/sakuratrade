#!/usr/bin/env python3
"""Run staged acceptance checks and support controlled rollback for workorder.

`run`（既定）コマンドは `smoke → unit → integration` の順にチェックを実行し、
結果を `.workorder-tests-logs/summary.json` に集約する。`--phase` を指定すると
個別フェーズのみを実行して同じサマリーファイルへ反映する。

`rollback` コマンドは最新コミットが指定 SHA に一致する場合のみ安全に
`git reset --hard` を行い、他のコミットには触れない。
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, List, Tuple

ROOT = Path(__file__).resolve().parent.parent
SYNC_PLAN_PATH = ROOT / "workorder_sync_plan.json"
DEFAULT_LOGS_DIR = ROOT / ".workorder-tests-logs"
DEFAULT_SUMMARY_PATH = DEFAULT_LOGS_DIR / "summary.json"
SummaryPayload = dict[str, Any]

STAGE_ORDER = ["smoke", "unit", "integration"]
_STAGE_KEYWORDS = {
    "smoke": ("smoke", "tsc", "fmt", "ruff"),
    "unit": ("unit", "pytest", "eslint", "mypy", "lint"),
    "integration": ("integration", "vitest", "playwright", "cypress", "e2e"),
}


@dataclass
class Check:
    """Single acceptance check entry."""

    name: str
    command: str
    stage: str


def _slugify(value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return cleaned or "check"


def _infer_stage(name: str, command: str) -> str:
    text = f"{name} {command}".lower()
    for stage in STAGE_ORDER:
        for keyword in _STAGE_KEYWORDS.get(stage, ()):  # type: ignore[arg-type]
            if keyword in text:
                return stage
    return "unit"


def _load_checks() -> list[Check]:
    if not SYNC_PLAN_PATH.exists():
        raise SystemExit(
            "workorder_sync_plan.json が見つかりません。"
            "先に `python -m scripts.workorder_cli ready` を実行してください。"
        )
    try:
        payload = json.loads(SYNC_PLAN_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"workorder_sync_plan.json の読み込みに失敗しました: {exc}") from exc

    checks: list[Check] = []
    for task in payload.get("tasks") or []:
        acceptance = task.get("acceptance") or {}
        for raw in acceptance.get("checks") or []:
            name = str(raw.get("name") or "")
            command = str(raw.get("command") or "")
            if not name or not command:
                continue
            stage = str(raw.get("stage") or "").lower().strip()
            if not stage:
                stage = _infer_stage(name, command)
            checks.append(Check(name=name, command=command, stage=stage))
    return checks


def _ordered_stages(checks: Iterable[Check]) -> list[str]:
    names: list[str] = []
    present = {check.stage for check in checks}
    for stage in STAGE_ORDER:
        if stage in present:
            names.append(stage)
    for check in checks:
        if check.stage not in names:
            names.append(check.stage)
    return names


def _run_command(command: str) -> Tuple[int, str]:
    completed = subprocess.run(
        command,
        cwd=ROOT,
        shell=True,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    output = completed.stdout or ""
    return completed.returncode, output


def _ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def _rel(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def _load_existing_summary(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def _write_summary(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def _stage_stub(name: str) -> dict[str, Any]:
    return {
        "name": name,
        "status": "pending",
        "checks": [],
        "failed_check": None,
        "failed_command": None,
    }


def cmd_run(args: argparse.Namespace) -> int:
    checks = _load_checks()
    summary_path = Path(args.summary or DEFAULT_SUMMARY_PATH).resolve()
    logs_dir = Path(args.logs_dir or DEFAULT_LOGS_DIR).resolve()
    _ensure_dir(logs_dir)

    existing = _load_existing_summary(summary_path)
    before_sha = (existing.get("before_sha") if isinstance(existing, dict) else None) or (args.before_sha or "")
    after_sha = (existing.get("after_sha") if isinstance(existing, dict) else None) or (args.after_sha or "")
    stage_map: dict[str, dict[str, Any]] = {}
    for stage in existing.get("stages", []) or []:
        name = stage.get("name")
        if isinstance(name, str) and name:
            stage_map[name] = {
                "name": name,
                "status": stage.get("status", "pending"),
                "checks": stage.get("checks", []),
                "failed_check": stage.get("failed_check"),
                "failed_command": stage.get("failed_command"),
            }

    ordered_all = _ordered_stages(checks)
    if args.phase:
        target_stages = [args.phase]
        if args.phase not in ordered_all:
            ordered_all.append(args.phase)
    else:
        target_stages = ordered_all

    if not checks:
        empty_result: SummaryPayload = {
            "status": "success",
            "stages": [],
            "failed_stage": None,
            "failed_check": None,
            "failed_command": None,
            "log_dir": _rel(logs_dir),
            "before_sha": before_sha,
            "after_sha": after_sha,
        }
        _write_summary(summary_path, empty_result)
        print("No acceptance checks defined. Nothing to run.")
        return 0

    for name in ordered_all:
        stage_map.setdefault(name, _stage_stub(name))

    for stage_name in target_stages:
        stage_checks = [check for check in checks if check.stage == stage_name]
        stage_summary = {
            "name": stage_name,
            "status": "skipped",
            "checks": [],
            "failed_check": None,
            "failed_command": None,
        }
        if not stage_checks:
            print(f"[workorder-tests] No checks registered for '{stage_name}'.")
            stage_map[stage_name] = stage_summary
            continue

        stage_status = "success"
        failed_check = None
        failed_command = None

        for index, check in enumerate(stage_checks, start=1):
            slug = _slugify(check.name or f"check-{index}")
            log_path = logs_dir / f"{stage_name}-{index:02d}-{slug}.log"
            code, output = _run_command(check.command)
            log_path.write_text(output, encoding="utf-8")
            entry = {
                "name": check.name,
                "command": check.command,
                "status": "success" if code == 0 else "failure",
                "return_code": code,
                "log": _rel(log_path),
            }
            stage_summary["checks"].append(entry)
            if code != 0:
                print(f"[workorder-tests] ❌ {check.name} failed (code={code}).")
                stage_status = "failure"
                failed_check = check.name
                failed_command = check.command
                for later_index, later in enumerate(stage_checks[index:], start=index + 1):
                    later_slug = _slugify(later.name or f"check-{later_index}")
                    skipped_path = logs_dir / f"{stage_name}-{later_index:02d}-{later_slug}.log"
                    skipped_path.write_text("<skipped due to earlier failure>\n", encoding="utf-8")
                    stage_summary["checks"].append(
                        {
                            "name": later.name,
                            "command": later.command,
                            "status": "skipped",
                            "return_code": None,
                            "log": _rel(skipped_path),
                        }
                    )
                break
            print(f"[workorder-tests] ✅ {check.name} passed.")

        stage_summary["status"] = stage_status
        stage_summary["failed_check"] = failed_check
        stage_summary["failed_command"] = failed_command
        stage_map[stage_name] = stage_summary

    ordered_output: List[dict[str, Any]] = []
    for name in STAGE_ORDER:
        if name in stage_map:
            ordered_output.append(stage_map[name])
    for name, info in stage_map.items():
        if name not in {stage["name"] for stage in ordered_output}:
            ordered_output.append(info)

    failed_entry = next((stage for stage in ordered_output if stage["status"] == "failure"), None)
    if failed_entry:
        overall_status = "failure"
        failed_stage = failed_entry["name"]
        failed_check = failed_entry.get("failed_check")
        failed_command = failed_entry.get("failed_command")
    else:
        overall_status = "success"
        failed_stage = None
        failed_check = None
        failed_command = None

    final_result: SummaryPayload = {
        "status": overall_status,
        "stages": ordered_output,
        "failed_stage": failed_stage,
        "failed_check": failed_check,
        "failed_command": failed_command,
        "log_dir": _rel(logs_dir),
        "before_sha": before_sha,
        "after_sha": after_sha,
    }
    _write_summary(summary_path, final_result)

    print("[workorder-tests] Summary:")
    print(json.dumps(final_result, indent=2, ensure_ascii=False))

    return 0 if overall_status == "success" else 1


def cmd_rollback(args: argparse.Namespace) -> int:
    commit = (args.commit or "").strip()
    if not commit:
        print("::error::rollback requires --commit")
        return 1

    logs_dir = Path(args.logs_dir or DEFAULT_LOGS_DIR).resolve()
    _ensure_dir(logs_dir)

    current = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    head = (current.stdout or "").strip()
    if head != commit:
        print(f"::warning::rollback skipped: HEAD {head or '<unknown>'} != expected {commit}.")
        return 1

    target = (args.to or "").strip()
    if not target:
        parent = subprocess.run(
            ["git", "rev-parse", f"{commit}^"],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        if parent.returncode != 0:
            print(f"::error::failed to resolve parent of {commit}: {parent.stderr.strip()}")
            return parent.returncode or 1
        target = (parent.stdout or "").strip()

    reset = subprocess.run(
        ["git", "reset", "--hard", target],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    if reset.returncode != 0:
        print(f"::error::git reset failed: {reset.stderr.strip()}")
        return reset.returncode or 1

    print(f"[workorder-tests] Rolled back to {target} from {commit}.")
    return 0


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run staged workorder acceptance checks")
    parser.add_argument("command", nargs="?", choices=["run", "rollback"], default="run")
    parser.add_argument("--phase", choices=STAGE_ORDER)
    parser.add_argument(
        "--summary",
        default=str(DEFAULT_SUMMARY_PATH),
        help=f"Summary JSON output path (default: {DEFAULT_SUMMARY_PATH})",
    )
    parser.add_argument(
        "--logs-dir",
        dest="logs_dir",
        default=str(DEFAULT_LOGS_DIR),
        help=f"Directory to store check logs (default: {DEFAULT_LOGS_DIR})",
    )
    parser.add_argument(
        "--log-dir",
        dest="logs_dir",
        help="Alias of --logs-dir for backward compatibility",
    )
    parser.add_argument("--before-sha", dest="before_sha", default="")
    parser.add_argument("--after-sha", dest="after_sha", default="")
    parser.add_argument("--commit")
    parser.add_argument("--to")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    if args.command == "rollback":
        return cmd_rollback(args)
    return cmd_run(args)


if __name__ == "__main__":
    raise SystemExit(main())
