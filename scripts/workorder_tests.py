#!/usr/bin/env python3
"""Run staged acceptance checks for workorder automation.

Reads ``workorder_sync_plan.json`` to discover ``acceptance.checks`` entries for
all tasks and executes them in the order ``smoke → unit → integration``.
Results are summarised to JSON so GitHub Actions can consume the outcome,
including the failing stage and command when a check stops the pipeline.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, List

ROOT = Path(__file__).resolve().parent.parent
SYNC_PLAN_PATH = ROOT / "workorder_sync_plan.json"
DEFAULT_LOG_DIR = ROOT / "tmp" / "workorder_tests"
DEFAULT_SUMMARY_PATH = ROOT / "tmp" / "workorder_tests_summary.json"

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


def _run_command(command: str) -> tuple[int, str]:
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


def _write_summary(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def cmd_run(args: argparse.Namespace) -> int:
    checks = _load_checks()
    if not checks:
        summary = {
            "status": "success",
            "stages": [],
            "failed_stage": None,
            "failed_check": None,
            "failed_command": None,
            "log_dir": str(Path(args.log_dir).resolve()),
        }
        _write_summary(Path(args.summary), summary)
        print("No acceptance checks defined. Nothing to run.")
        return 0

    log_dir = Path(args.log_dir).resolve()
    log_dir.mkdir(parents=True, exist_ok=True)

    stages = _ordered_stages(checks)
    stage_summaries: List[dict[str, Any]] = []
    overall_status = "success"
    failed_stage: str | None = None
    failed_check: str | None = None
    failed_command: str | None = None

    for stage in stages:
        stage_checks = [check for check in checks if check.stage == stage]
        stage_checks_summary: list[dict[str, Any]] = []
        stage_summary = {
            "name": stage,
            "status": "skipped",
            "checks": stage_checks_summary,
        }
        stage_summaries.append(stage_summary)

        if overall_status == "failure":
            for check in stage_checks:
                stage_checks_summary.append(
                    {
                        "name": check.name,
                        "command": check.command,
                        "status": "skipped",
                        "return_code": None,
                        "log": None,
                    }
                )
            continue

        stage_status = "success"
        for index, check in enumerate(stage_checks, start=1):
            slug = _slugify(check.name or f"check-{index}")
            log_path = log_dir / f"{stage}-{index:02d}-{slug}.log"
            print(f"[workorder-tests] Running {stage}: {check.name}\n→ {check.command}")
            code, output = _run_command(check.command)
            log_path.write_text(output, encoding="utf-8")
            stage_checks_summary.append(
                {
                    "name": check.name,
                    "command": check.command,
                    "status": "success" if code == 0 else "failure",
                    "return_code": code,
                    "log": str(log_path.relative_to(ROOT)),
                }
            )
            if code != 0:
                print(f"[workorder-tests] ❌ {check.name} failed (code={code}).")
                stage_status = "failure"
                overall_status = "failure"
                failed_stage = stage
                failed_check = check.name
                failed_command = check.command
                # Remaining checks in this stage and subsequent stages are skipped
                remaining = stage_checks[index:]
                for later_index, later in enumerate(remaining, start=index + 1):
                    later_slug = _slugify(later.name or f"check-{later_index}")
                    skipped_path = log_dir / f"{stage}-{later_index:02d}-{later_slug}.log"
                    skipped_path.write_text("<skipped due to earlier failure>\n", encoding="utf-8")
                    stage_checks_summary.append(
                        {
                            "name": later.name,
                            "command": later.command,
                            "status": "skipped",
                            "return_code": None,
                            "log": str(skipped_path.relative_to(ROOT)),
                        }
                    )
                break
            else:
                print(f"[workorder-tests] ✅ {check.name} passed.")
        stage_summary["status"] = stage_status

    result: dict[str, Any] = {
        "status": overall_status,
        "stages": stage_summaries,
        "failed_stage": failed_stage,
        "failed_check": failed_check,
        "failed_command": failed_command,
        "log_dir": str(log_dir.relative_to(ROOT)),
    }
    _write_summary(Path(args.summary), result)

    print("[workorder-tests] Summary:")
    print(json.dumps(result, indent=2, ensure_ascii=False))

    return 0 if overall_status == "success" else 1


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run staged workorder acceptance checks")
    sub = parser.add_subparsers(dest="command", required=True)

    run_parser = sub.add_parser("run", help="Execute acceptance checks sequentially")
    run_parser.add_argument(
        "--summary",
        default=str(DEFAULT_SUMMARY_PATH),
        help=f"Summary JSON output path (default: {DEFAULT_SUMMARY_PATH})",
    )
    run_parser.add_argument(
        "--log-dir",
        default=str(DEFAULT_LOG_DIR),
        help=f"Directory to store check logs (default: {DEFAULT_LOG_DIR})",
    )

    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    if args.command == "run":
        return cmd_run(args)
    raise SystemExit("Unknown command")


if __name__ == "__main__":
    raise SystemExit(main())
