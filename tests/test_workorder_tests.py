from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path

import pytest
from scripts import workorder_tests

pytestmark = pytest.mark.no_db


def _write_sync_plan(path: Path, checks: list[tuple[str, str]]) -> None:
    payload = {
        "tasks": [
            {
                "id": "T-sample",
                "acceptance": {"checks": [{"name": name, "command": command} for name, command in checks]},
            }
        ]
    }
    path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")


def _prepare_repo(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> tuple[Path, Path, Path, Path]:
    root = tmp_path / "repo"
    root.mkdir()
    sync_plan = root / "workorder_sync_plan.json"
    logs_dir = root / ".workorder-tests-logs"
    summary = logs_dir / "summary.json"
    monkeypatch.setattr(workorder_tests, "ROOT", root)
    monkeypatch.setattr(workorder_tests, "SYNC_PLAN_PATH", sync_plan)
    monkeypatch.setattr(workorder_tests, "DEFAULT_LOGS_DIR", logs_dir)
    monkeypatch.setattr(workorder_tests, "DEFAULT_SUMMARY_PATH", summary)
    return root, sync_plan, logs_dir, summary


def test_infer_stage() -> None:
    assert workorder_tests._infer_stage("frontend-tsc", "npx --prefix frontend tsc --noEmit") == "smoke"
    assert workorder_tests._infer_stage("frontend-eslint", "npx eslint") == "unit"
    assert workorder_tests._infer_stage("frontend-vitest", "npm run test:run") == "integration"
    assert workorder_tests._infer_stage("custom", "echo something") == "unit"


def _run_git(cmd: list[str], cwd: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, cwd=cwd, text=True, capture_output=True, check=True)


def test_cmd_run_success(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    root, sync_plan, logs_dir, summary_path = _prepare_repo(monkeypatch, tmp_path)
    _write_sync_plan(
        sync_plan,
        [
            ("frontend-tsc", "python3 -c \"print('tsc ok')\""),
            ("frontend-vitest", "python3 -c \"print('vitest ok')\""),
        ],
    )

    args = argparse.Namespace(
        command="run",
        phase=None,
        summary=str(summary_path),
        logs_dir=str(logs_dir),
        commit=None,
        to=None,
    )
    exit_code = workorder_tests.cmd_run(args)

    assert exit_code == 0
    data = json.loads(summary_path.read_text(encoding="utf-8"))
    assert data["status"] == "success"
    assert data["failed_stage"] is None
    assert Path(root / data["log_dir"]).exists()
    for stage in data["stages"]:
        assert stage["status"] == "success"
        for check in stage["checks"]:
            assert Path(root / check["log"]).is_file()


def test_cmd_run_failure(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    root, sync_plan, logs_dir, summary_path = _prepare_repo(monkeypatch, tmp_path)
    _write_sync_plan(
        sync_plan,
        [
            ("frontend-tsc", "python3 -c \"print('tsc ok')\""),
            ("frontend-vitest", 'python3 -c "import sys; sys.exit(2)"'),
        ],
    )

    args = argparse.Namespace(
        command="run",
        phase=None,
        summary=str(summary_path),
        logs_dir=str(logs_dir),
        commit=None,
        to=None,
    )
    exit_code = workorder_tests.cmd_run(args)

    assert exit_code == 1
    data = json.loads(summary_path.read_text(encoding="utf-8"))
    assert data["status"] == "failure"
    assert data["failed_stage"] == "integration"
    assert data["failed_check"] == "frontend-vitest"
    assert Path(root / data["log_dir"] / "integration-01-frontend-vitest.log").exists()
    # subsequent stages (if any) would be skipped; ensure failure command recorded
    stage_records = {stage["name"]: stage for stage in data["stages"]}
    assert stage_records["integration"]["checks"][0]["status"] == "failure"


def test_cmd_run_no_checks(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    root, sync_plan, logs_dir, summary_path = _prepare_repo(monkeypatch, tmp_path)
    sync_plan.write_text(json.dumps({"tasks": []}), encoding="utf-8")

    args = argparse.Namespace(
        command="run",
        phase=None,
        summary=str(summary_path),
        logs_dir=str(logs_dir),
        commit=None,
        to=None,
    )
    exit_code = workorder_tests.cmd_run(args)

    assert exit_code == 0
    data = json.loads(summary_path.read_text(encoding="utf-8"))
    assert data["status"] == "success"
    assert data["stages"] == []


def test_cmd_run_phase_updates_existing_summary(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    root, sync_plan, logs_dir, summary_path = _prepare_repo(monkeypatch, tmp_path)
    _write_sync_plan(
        sync_plan,
        [
            ("frontend-tsc", "python3 -c \"print('tsc ok')\""),
            ("frontend-pytest", "python3 -c \"print('pytest ok')\""),
        ],
    )

    args = argparse.Namespace(
        command="run",
        phase="smoke",
        summary=str(summary_path),
        logs_dir=str(logs_dir),
        commit=None,
        to=None,
    )
    exit_code = workorder_tests.cmd_run(args)
    assert exit_code == 0

    data = json.loads(summary_path.read_text(encoding="utf-8"))
    stages = {stage["name"]: stage for stage in data["stages"]}
    assert stages["smoke"]["status"] == "success"
    assert stages["unit"]["status"] == "pending"

    # run unit phase and ensure summary merges with previous data
    args.phase = "unit"
    exit_code = workorder_tests.cmd_run(args)
    assert exit_code == 0

    data = json.loads(summary_path.read_text(encoding="utf-8"))
    stages = {stage["name"]: stage for stage in data["stages"]}
    assert stages["smoke"]["status"] == "success"
    assert stages["unit"]["status"] == "success"


def test_cmd_rollback(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    root, sync_plan, logs_dir, summary_path = _prepare_repo(monkeypatch, tmp_path)
    (root / "README.md").write_text("init\n", encoding="utf-8")
    _run_git(["git", "init"], root)
    _run_git(["git", "config", "user.name", "Tester"], root)
    _run_git(["git", "config", "user.email", "tester@example.com"], root)
    _run_git(["git", "add", "README.md"], root)
    _run_git(["git", "commit", "-m", "initial"], root)

    (root / "README.md").write_text("updated\n", encoding="utf-8")
    _run_git(["git", "commit", "-am", "update"], root)

    before = subprocess.run(
        ["git", "rev-parse", "HEAD^"], cwd=root, text=True, capture_output=True, check=True
    ).stdout.strip()
    head = subprocess.run(
        ["git", "rev-parse", "HEAD"], cwd=root, text=True, capture_output=True, check=True
    ).stdout.strip()

    args = argparse.Namespace(
        command="rollback",
        phase=None,
        summary=str(summary_path),
        logs_dir=str(logs_dir),
        commit=head,
        to=before,
    )
    exit_code = workorder_tests.cmd_rollback(args)
    assert exit_code == 0

    current = subprocess.run(
        ["git", "rev-parse", "HEAD"], cwd=root, text=True, capture_output=True, check=True
    ).stdout.strip()
    assert current == before
