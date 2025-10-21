#!/usr/bin/env python3
"""Lint GitHub Actions workflows for dangerous permission defaults."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Iterable

import yaml

REPO_ROOT = Path(__file__).resolve().parents[1]
WORKFLOWS_DIR = REPO_ROOT / ".github" / "workflows"
SEC_ROW_PATH = REPO_ROOT / "docs" / "agile" / ".sec-review-row"


class LintIssue:
    def __init__(self, workflow: Path, message: str) -> None:
        self.workflow = workflow
        self.message = message

    def __str__(self) -> str:  # pragma: no cover - trivial
        return f"{self.workflow.relative_to(REPO_ROOT)}: {self.message}"


def iter_workflow_files() -> Iterable[Path]:
    yield from sorted(WORKFLOWS_DIR.glob("*.yml"))
    yield from sorted(WORKFLOWS_DIR.glob("*.yaml"))


def load_workflow(path: Path) -> tuple[dict[str, Any], list[LintIssue]]:
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except yaml.YAMLError as exc:
        return {}, [LintIssue(path, f"failed to parse YAML: {exc}")]
    except OSError as exc:
        return {}, [LintIssue(path, f"failed to read file: {exc}")]
    if not isinstance(data, dict):
        return {}, [LintIssue(path, "expected workflow to deserialize into a mapping")]  # pragma: no cover
    return data, []


def workflow_uses_pull_request_target(raw_on: Any) -> bool:
    if isinstance(raw_on, str):
        return raw_on == "pull_request_target"
    if isinstance(raw_on, list):
        return any(item == "pull_request_target" for item in raw_on if isinstance(item, str))
    if isinstance(raw_on, dict):
        return "pull_request_target" in raw_on
    return False


def has_explicit_permissions(data: dict[str, Any]) -> bool:
    return "permissions" in data


def find_secrets_inherit(data: dict[str, Any], path: Path) -> list[LintIssue]:
    issues: list[LintIssue] = []

    def visit(node: Any, pointer: str) -> None:
        if isinstance(node, dict):
            for key, value in node.items():
                new_pointer = f"{pointer}.{key}" if pointer else str(key)
                if key == "secrets" and value == "inherit":
                    issues.append(LintIssue(path, f"{new_pointer}: usage of 'secrets: inherit' is forbidden"))
                visit(value, new_pointer)
        elif isinstance(node, list):
            for idx, item in enumerate(node):
                visit(item, f"{pointer}[{idx}]")

    visit(data.get("jobs", {}), "jobs")
    return issues


def checkout_step_needs_ref(step: dict[str, Any]) -> bool:
    uses = step.get("uses")
    if not isinstance(uses, str):
        return False
    return uses.startswith("actions/checkout@")


def validate_checkout_pinning(data: dict[str, Any], path: Path) -> list[LintIssue]:
    issues: list[LintIssue] = []
    jobs = data.get("jobs")
    if not isinstance(jobs, dict):
        return issues

    for job_id, job_data in jobs.items():
        if not isinstance(job_data, dict):
            continue
        steps = job_data.get("steps")
        if not isinstance(steps, list):
            continue
        for index, step in enumerate(steps):
            if not isinstance(step, dict) or not checkout_step_needs_ref(step):
                continue
            with_block = step.get("with") if isinstance(step.get("with"), dict) else {}
            ref_value = with_block.get("ref") if isinstance(with_block, dict) else None
            if ref_value != "${{ github.event.pull_request.base.sha }}":
                name = step.get("name") or f"step {index + 1}"
                issues.append(
                    LintIssue(
                        path,
                        f"job '{job_id}', {name}: checkout must pin ref to ${{ github.event.pull_request.base.sha }}",
                    )
                )
    return issues


def update_status_row(issues_count: int) -> None:
    status = "OK" if issues_count == 0 else "NG"
    row = f"| sec-review | {status} | {issues_count} |\n"
    SEC_ROW_PATH.parent.mkdir(parents=True, exist_ok=True)
    SEC_ROW_PATH.write_text(row, encoding="utf-8")


def main() -> int:
    issues: list[LintIssue] = []

    for workflow_path in iter_workflow_files():
        data, load_issues = load_workflow(workflow_path)
        issues.extend(load_issues)
        if load_issues:
            continue

        if not has_explicit_permissions(data):
            issues.append(LintIssue(workflow_path, "missing top-level permissions block"))

        if workflow_uses_pull_request_target(data.get("on")):
            issues.extend(validate_checkout_pinning(data, workflow_path))

        issues.extend(find_secrets_inherit(data, workflow_path))

    for issue in issues:
        print(issue)

    update_status_row(len(issues))

    return 0 if not issues else 1


if __name__ == "__main__":
    sys.exit(main())
