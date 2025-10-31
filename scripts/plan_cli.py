#!/usr/bin/env python3
"""codex-docsync plan CLI

Subcommands
-----------
preflight  Generate doc_sync_plan.json based on git diff and mapping rules
apply      Update docs/agile/plan.md AUTO sections using preflight data
validate   Run validation checks for plan.md (format + structural rules)
pr         (Stub) Show instructions for creating/updating Draft PR

This is a lightweight first implementation. It focuses on the data flow required
for PL-1/PL-2: reading specification sources (UI spec, OpenAPI, tests), building
INPUTS/OUTPUTS/TASKS, and keeping plan.md in sync.
"""

from __future__ import annotations

import argparse
import dataclasses
import datetime as dt
import fnmatch
import hashlib
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Any, Iterable, Sequence

from scripts.docsync_utils import render_yaml_block, replace_auto_block

ROOT = Path(__file__).resolve().parent.parent

PLAN_PATH = ROOT / "docs" / "agile" / "plan.md"
UI_SPEC_PATH = ROOT / "docs" / "agile" / "ui-specification.md"
OPENAPI_PATH = ROOT / "backend" / "app" / "openapi.yaml"
DOCS_TESTS_DIR = ROOT / "docs" / "tests"
DOC_SYNC_PLAN_PATH = ROOT / "doc_sync_plan.json"

DEFAULT_ALLOWED_PATTERNS = [
    "docs/agile/**",
    "docs/specs/**",
    "docs/tests/**",
    ".github/workflows/**",
    "backend/app/openapi.yaml",
]

# Block list is intentionally short; callers can expand via env if needed.
DEFAULT_BLOCKED_PATTERNS = ["docs/secrets/**"]


def _resolve_report_path() -> Path:
    raw = os.environ.get("PLAN_SYNC_RUN_REPORT")
    if raw:
        candidate = Path(raw)
        if not candidate.is_absolute():
            candidate = ROOT / candidate
        return candidate
    return ROOT / "tmp" / "plan_limits_report.json"


RUN_REPORT_PATH = _resolve_report_path()

# ---------------------------------------------------------------------------
# Data models


@dataclasses.dataclass
class UISpecSection:
    title: str
    anchor: str


@dataclasses.dataclass
class ApiOperation:
    method: str
    path: str


@dataclasses.dataclass
class TestFlow:
    label: str
    path: str


@dataclasses.dataclass
class PreflightData:
    base: str
    head: str
    changed_files: list[str]
    triggers: list[str]
    ui_sections: list[UISpecSection]
    api_operations: list[ApiOperation]
    test_flows: list[TestFlow]

    def to_json(self) -> dict:
        return {
            "base": self.base,
            "head": self.head,
            "changed_files": self.changed_files,
            "triggers": self.triggers,
            "ui_sections": [dataclasses.asdict(s) for s in self.ui_sections],
            "api_operations": [dataclasses.asdict(op) for op in self.api_operations],
            "test_flows": [dataclasses.asdict(tf) for tf in self.test_flows],
        }

    @classmethod
    def from_json(cls, data: dict) -> "PreflightData":
        return cls(
            base=data.get("base", ""),
            head=data.get("head", ""),
            changed_files=data.get("changed_files", []),
            triggers=data.get("triggers", []),
            ui_sections=[UISpecSection(**s) for s in data.get("ui_sections", [])],
            api_operations=[ApiOperation(**op) for op in data.get("api_operations", [])],
            test_flows=[TestFlow(**tf) for tf in data.get("test_flows", [])],
        )


# ---------------------------------------------------------------------------
# Helper utilities


def _split_patterns(raw: str | None) -> list[str]:
    if not raw:
        return []
    return [item.strip() for item in raw.split(",") if item.strip()]


def _load_allowed_patterns() -> list[str]:
    patterns = _split_patterns(os.environ.get("PLAN_SYNC_ALLOWED_PATHS"))
    return patterns or DEFAULT_ALLOWED_PATTERNS


def _load_blocked_patterns() -> list[str]:
    patterns = _split_patterns(os.environ.get("PLAN_SYNC_BLOCKED_PATHS"))
    return patterns or DEFAULT_BLOCKED_PATTERNS


def _matches_any(path: str, patterns: Sequence[str]) -> bool:
    normalized = path.replace("\\", "/")
    return any(fnmatch.fnmatch(normalized, pattern) for pattern in patterns)


def _safe_int(value: str | None, default: int, *, env_name: str) -> int:
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        print(
            f"[plan-cli] Invalid value for {env_name}={value!r}; falling back to {default}",
            file=sys.stderr,
        )
        return default


def _load_limit_config() -> tuple[int, int]:
    max_lines = _safe_int(
        os.environ.get("PLAN_SYNC_MAX_CHANGED_LINES"),
        300,
        env_name="PLAN_SYNC_MAX_CHANGED_LINES",
    )
    max_files = _safe_int(
        os.environ.get("PLAN_SYNC_MAX_CHANGED_FILES"),
        4,
        env_name="PLAN_SYNC_MAX_CHANGED_FILES",
    )
    return max_lines, max_files


def _update_report(section: str, payload: dict[str, Any]) -> None:
    try:
        RUN_REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    except FileExistsError:
        pass
    report: dict[str, Any] = {}
    if RUN_REPORT_PATH.exists():
        try:
            report = json.loads(RUN_REPORT_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            report = {}
    report[section] = payload
    RUN_REPORT_PATH.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")


def _collect_diff_stats(paths: Sequence[str] | None = None) -> dict[str, Any]:
    cmd = ["git", "diff", "--numstat"]
    if paths:
        cmd.append("--")
        cmd.extend(paths)
    completed = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, check=True)
    files: list[dict[str, Any]] = []
    total_lines = 0
    for line in completed.stdout.splitlines():
        parts = line.split("\t")
        if len(parts) < 3:
            continue
        added_raw, deleted_raw, path = parts[:3]
        added = 0 if added_raw == "-" else int(added_raw or 0)
        deleted = 0 if deleted_raw == "-" else int(deleted_raw or 0)
        total_lines += added + deleted
        files.append({"path": path, "added": added, "deleted": deleted})
    return {"files": files, "file_count": len(files), "total_lines": total_lines}


def _enforce_limits(max_lines: int, max_files: int) -> None:
    stats = _collect_diff_stats()
    status_payload: dict[str, Any] = {
        "status": "ok",
        "stats": stats,
        "max_lines": max_lines,
        "max_files": max_files,
    }

    if stats["total_lines"] > max_lines:
        status_payload.update(
            {
                "status": "limit_exceeded",
                "limit_type": "lines",
                "actual": stats["total_lines"],
            }
        )
        _update_report("apply", status_payload)
        raise SystemExit(
            f"plan diff changed {stats['total_lines']} lines which exceeds the limit of {max_lines}"
        )

    if stats["file_count"] > max_files:
        status_payload.update(
            {
                "status": "limit_exceeded",
                "limit_type": "files",
                "actual": stats["file_count"],
            }
        )
        _update_report("apply", status_payload)
        raise SystemExit(
            f"plan diff touched {stats['file_count']} files which exceeds the limit of {max_files}"
        )

    if stats["file_count"] == 0:
        status_payload["status"] = "no_changes"

    _update_report("apply", status_payload)


def run_git(args: list[str]) -> str:
    result = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} failed: {result.stderr.strip()}")
    return result.stdout.strip()


def detect_base_ref() -> str:
    """Return merge-base of HEAD and origin/main (fallback: HEAD^)."""
    try:
        base = run_git(["merge-base", "HEAD", "origin/main"])
        if base:
            return base
    except RuntimeError:
        pass
    try:
        base = run_git(["rev-parse", "HEAD^"])
        return base
    except RuntimeError as exc:
        raise RuntimeError("Unable to determine base reference for git diff") from exc


def get_changed_files(base: str, head: str) -> list[str]:
    output = run_git(["diff", "--name-only", f"{base}..{head}"])
    return [line.strip() for line in output.splitlines() if line.strip()]


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def file_checksum(path: Path) -> str:
    if path.is_dir():
        parts = []
        for p in sorted(path.rglob("*")):
            if p.is_file():
                parts.append(sha256_text(p.read_text(encoding="utf-8", errors="ignore")))
        combined = "".join(parts)
        return sha256_text(combined)
    if not path.exists():
        return ""
    return sha256_text(path.read_text(encoding="utf-8"))


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def parse_ui_spec_sections() -> list[UISpecSection]:
    if not UI_SPEC_PATH.exists():
        return []
    text = UI_SPEC_PATH.read_text(encoding="utf-8")
    match = re.search(r"<!-- ASSIST-START:ui-spec -->(?P<body>.*?)<!-- ASSIST-END:ui-spec -->", text, re.DOTALL)
    if not match:
        return []
    body = match.group("body")
    sections = []
    for title in re.findall(r"^###\s+(.+)$", body, re.MULTILINE):
        anchor = slugify(title)
        sections.append(UISpecSection(title=title.strip(), anchor=anchor))
    return sections


def parse_openapi_operations(diff_text: str | None = None) -> list[ApiOperation]:
    if diff_text:
        # Extract operations touched in diff (lines starting with + or -)
        operations = set()
        current_path = None
        for line in diff_text.splitlines():
            if line.startswith("+++") or line.startswith("---"):
                continue
            clean = line[1:] if line.startswith(("+", "-")) else line
            path_match = re.match(r"\s*\/[^:]+:\s*$", clean)
            if path_match:
                current_path = clean.strip().rstrip(":")
                continue
            method_match = re.match(r"\s*(get|post|put|patch|delete|options|head):\s*$", clean)
            if method_match and current_path:
                operations.add((method_match.group(1), current_path))
        if operations:
            return [ApiOperation(method=m, path=p) for (m, p) in sorted(operations)]
    # fallback → include entire spec (only if PyYAML 利用可)
    if not OPENAPI_PATH.exists():
        return []
    try:
        import yaml  # type: ignore

        data = yaml.safe_load(OPENAPI_PATH.read_text(encoding="utf-8")) or {}
    except Exception:
        return []
    paths = data.get("paths", {})
    fallback_ops: list[ApiOperation] = []
    for path, body in paths.items():
        if not isinstance(body, dict):
            continue
        for method, _spec in body.items():
            if method.lower() in {"get", "post", "put", "patch", "delete", "options", "head"}:
                fallback_ops.append(ApiOperation(method=method.lower(), path=path))
    return fallback_ops


def detect_test_flows(changed_files: Iterable[str]) -> list[TestFlow]:
    flows = []
    for rel in changed_files:
        if rel.startswith("docs/tests/"):
            flows.append(TestFlow(label=Path(rel).stem, path=rel))
    return flows


# ---------------------------------------------------------------------------
# Preflight logic


def cmd_preflight(args: argparse.Namespace) -> None:
    base = detect_base_ref()
    head = run_git(["rev-parse", "HEAD"])
    changed_files = get_changed_files(base, head)
    allowed_patterns = _load_allowed_patterns()
    blocked_patterns = _load_blocked_patterns()
    blocked_files = [f for f in changed_files if _matches_any(f, blocked_patterns)]
    if blocked_files:
        _update_report(
            "preflight",
            {
                "status": "blocked_paths",
                "base": base,
                "head": head,
                "total_changed": len(changed_files),
                "blocked_files": blocked_files,
                "original_changed_files": changed_files,
                "allowed_patterns": allowed_patterns,
                "blocked_patterns": blocked_patterns,
            },
        )
        raise SystemExit(
            "Detected blocked paths in diff: " + ", ".join(sorted(blocked_files))
        )

    disallowed_files = [f for f in changed_files if not _matches_any(f, allowed_patterns)]
    effective_changed_files = []
    if disallowed_files:
        print(
            "plan preflight: diff contains files outside allowlist; treating as No-Op",
            file=sys.stderr,
        )
    else:
        effective_changed_files = [f for f in changed_files if _matches_any(f, allowed_patterns)]

    triggers: list[str] = []

    if any(f == "docs/agile/ui-specification.md" for f in effective_changed_files):
        triggers.append("ui_spec_manual")
    if any(f in {"backend/app/openapi.yaml", "docs/specs/openapi.yaml"} for f in effective_changed_files):
        triggers.append("openapi_changed")
    if any(f.startswith("docs/tests/") for f in effective_changed_files):
        triggers.append("tests_changed")
    if any(
        f.startswith(".github/workflows/") or f.startswith("docs/agile/")
        for f in effective_changed_files
    ):
        triggers.append("docs_ci_changed")

    ui_sections = parse_ui_spec_sections() if "ui_spec_manual" in triggers else []

    diff_text = None
    if "openapi_changed" in triggers:
        try:
            diff_text = run_git(["diff", base, head, "--", "backend/app/openapi.yaml"])
        except RuntimeError:
            diff_text = None
    api_operations = parse_openapi_operations(diff_text) if "openapi_changed" in triggers else []

    test_flows = detect_test_flows(changed_files) if "tests_changed" in triggers else []

    data = PreflightData(
        base=base,
        head=head,
        changed_files=effective_changed_files,
        triggers=triggers,
        ui_sections=ui_sections,
        api_operations=api_operations,
        test_flows=test_flows,
    )

    DOC_SYNC_PLAN_PATH.write_text(json.dumps(data.to_json(), indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Saved {DOC_SYNC_PLAN_PATH.relative_to(ROOT)}")
    status = "ok"
    if disallowed_files:
        status = "skipped_disallowed"
    elif not triggers:
        status = "no_triggers"

    _update_report(
        "preflight",
        {
            "status": status,
            "base": base,
            "head": head,
            "total_changed": len(changed_files),
            "changed_files": effective_changed_files,
            "original_changed_files": changed_files,
            "disallowed_files": disallowed_files,
            "blocked_files": blocked_files,
            "allowed_patterns": allowed_patterns,
            "blocked_patterns": blocked_patterns,
            "triggers": triggers,
            "no_op": not triggers,
        },
    )

    if triggers:
        print(f"Detected triggers: {', '.join(triggers)}")
    else:
        print("No relevant triggers detected (No-Op)")


# ---------------------------------------------------------------------------
# Apply logic


def load_preflight() -> PreflightData:
    if not DOC_SYNC_PLAN_PATH.exists():
        raise SystemExit("doc_sync_plan.json が見つかりません。先に preflight を実行してください。")
    return PreflightData.from_json(json.loads(DOC_SYNC_PLAN_PATH.read_text(encoding="utf-8")))


def plan_snapshot_id(data: PreflightData) -> str:
    parts = []
    # Always include core sources (if they exist)
    for path in [UI_SPEC_PATH, OPENAPI_PATH, DOCS_TESTS_DIR]:
        if path.exists():
            parts.append(file_checksum(path))
    combined = "".join(parts)
    return sha256_text(combined) if combined else ""


def build_inputs(data: PreflightData) -> list[dict]:
    inputs: list[dict] = []
    if UI_SPEC_PATH.exists():
        inputs.append(
            {
                "name": "ui-specification",
                "path": str(UI_SPEC_PATH.relative_to(ROOT)),
                "checksum": file_checksum(UI_SPEC_PATH),
            }
        )
    if OPENAPI_PATH.exists():
        inputs.append(
            {
                "name": "openapi",
                "path": str(OPENAPI_PATH.relative_to(ROOT)),
                "checksum": file_checksum(OPENAPI_PATH),
            }
        )
    if DOCS_TESTS_DIR.exists():
        inputs.append(
            {
                "name": "test-specs",
                "path": str(DOCS_TESTS_DIR.relative_to(ROOT)),
                "checksum": file_checksum(DOCS_TESTS_DIR),
            }
        )
    return inputs


def build_outputs(data: PreflightData, snapshot: str) -> dict:
    touched = sorted(set(data.changed_files))
    buckets: dict[str, list[str]] = {"add": [], "modify": [], "delete": []}
    for rel in touched:
        if not rel:
            continue
        if rel.startswith(".github/workflows/"):
            buckets["modify"].append(rel)
        elif rel.startswith("docs/") or rel.startswith("backend/") or rel.startswith("frontend/"):
            # naive classification (no deletion info from name-only diff)
            buckets["modify"].append(rel)
    return {
        "plan_snapshot_id": snapshot,
        "targets": {k: v for k, v in buckets.items() if v},
    }


def build_tasks(data: PreflightData) -> list[dict]:
    tasks: list[dict] = []

    for section in data.ui_sections:
        slug = slugify(section.title)
        tasks.append(
            {
                "id": f"U-{slug}-update",
                "refs": [f"ui-spec:{section.anchor}"],
                "outputs": ["frontend/src"],
                "acceptance": {
                    "max_changed_lines": 80,
                    "checks": [
                        {"name": "frontend-tsc", "command": "npx --prefix frontend tsc --noEmit"},
                        {
                            "name": "frontend-eslint",
                            "command": ("npx --prefix frontend eslint src --max-warnings=500 --quiet"),
                        },
                        {
                            "name": "frontend-vitest",
                            "command": ("npm --prefix frontend run test:run -- --passWithNoTests"),
                        },
                    ],
                },
                "gate": [],
                "deps": [],
                "risk": "低",
                "rollback": "前バージョンのUIを再適用",
            }
        )

    for op in data.api_operations:
        slug = slugify(op.path.strip("/").replace("/", "-")) or "root"
        tasks.append(
            {
                "id": f"A-{slug}.{op.method.lower()}",
                "refs": [f"openapi:{op.method.upper()}:{op.path}"],
                "outputs": ["backend/app"],
                "acceptance": {
                    "max_changed_lines": 80,
                    "checks": [
                        {"name": "ruff", "command": "ruff check backend/app"},
                        {"name": "mypy", "command": "mypy backend/app"},
                        {"name": "pytest", "command": "pytest -q -m 'not integration'"},
                        {"name": "oas-lint", "command": "make oas-lint"},
                    ],
                },
                "gate": [],
                "deps": [],
                "risk": "中",
                "rollback": "OpenAPI差分を元に戻す",
            }
        )

    for flow in data.test_flows:
        slug = slugify(flow.label)
        tasks.append(
            {
                "id": f"T-{slug}-update",
                "refs": [f"tests:integration:{flow.label}"],
                "outputs": [flow.path],
                "acceptance": {
                    "max_changed_lines": 80,
                    "checks": [
                        {"name": "pytest", "command": f"pytest -q {flow.path}"},
                    ],
                },
                "gate": [],
                "deps": [],
                "risk": "低",
                "rollback": "テストケースを前版に戻す",
            }
        )

    return tasks


def cmd_apply(args: argparse.Namespace) -> None:
    data = load_preflight()
    max_lines, max_files = _load_limit_config()
    if not data.triggers:
        stats = _collect_diff_stats()
        _update_report(
            "apply",
            {
                "status": "no_triggers",
                "stats": stats,
                "max_lines": max_lines,
                "max_files": max_files,
                "no_op": True,
            },
        )
        print("No triggers found. Nothing to apply.")
        return

    snapshot = plan_snapshot_id(data)
    inputs = build_inputs(data)
    outputs = build_outputs(data, snapshot)
    tasks = build_tasks(data)

    now = dt.datetime.now(dt.timezone.utc).astimezone()
    meta_block = render_yaml_block(
        [
            {"plan_snapshot_id": snapshot},
            {"Doc ID": "plan"},
            {"Updated at": now.isoformat(timespec="seconds")},
            {"Related PRs": []},
        ]
    )

    inputs_block = render_yaml_block(inputs)
    outputs_block = render_yaml_block(outputs)
    tasks_block = render_yaml_block(tasks)

    original = PLAN_PATH.read_text(encoding="utf-8")
    updated = original
    updated = replace_auto_block(updated, "plan.meta", meta_block)
    updated = replace_auto_block(updated, "plan.inputs", inputs_block)
    updated = replace_auto_block(updated, "plan.outputs", outputs_block)
    updated = replace_auto_block(updated, "plan.tasks", tasks_block)

    if updated != original:
        PLAN_PATH.write_text(updated, encoding="utf-8")
        print(f"Updated {PLAN_PATH.relative_to(ROOT)}")
    else:
        print("plan.md に差分はありませんでした。")

    _enforce_limits(max_lines, max_files)


# ---------------------------------------------------------------------------
# Validation & PR stubs


def cmd_validate(args: argparse.Namespace) -> None:
    result = subprocess.run(["scripts/validate-agile-docs"], cwd=ROOT, text=True)
    if result.returncode != 0:
        raise SystemExit(result.returncode)


def cmd_pr(args: argparse.Namespace) -> None:
    data = load_preflight()
    if not data.triggers:
        print("No triggers detected. PR 作成は不要です。")
        return
    print("現段階では自動PR作成を実装していません。次の手順で対応してください:")
    print("1. git status で差分を確認")
    print("2. 固定ブランチ（例: docs-sync/plan）を作成し push")
    print("3. GitHub 上で Draft PR を起票 (タイトル例: chore(plan): auto-sync)")


# ---------------------------------------------------------------------------
# CLI entry point


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="codex-docsync plan CLI")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("preflight", help="Detect triggers and generate doc_sync_plan.json")
    sub.add_parser("apply", help="Update plan.md AUTO sections using preflight data")
    sub.add_parser("validate", help="Run plan validators")
    sub.add_parser("pr", help="(Stub) print instructions for PR creation")

    args = parser.parse_args(argv)

    if args.command == "preflight":
        cmd_preflight(args)
    elif args.command == "apply":
        cmd_apply(args)
    elif args.command == "validate":
        cmd_validate(args)
    elif args.command == "pr":
        cmd_pr(args)
    else:
        parser.error("Unknown command")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
