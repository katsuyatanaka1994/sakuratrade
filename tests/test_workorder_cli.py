from __future__ import annotations

import argparse
import json
import re
import subprocess
from pathlib import Path

import pytest
from scripts import docsync_utils, workorder_cli

pytestmark = pytest.mark.no_db


PLAN_TEMPLATE = """# Plan
<!-- AUTO:BEGIN name=plan.meta -->
- plan_snapshot_id: SNAP123
- Doc ID: plan
- Updated at: 2025-01-01T00:00:00+00:00
- Related PRs: []
<!-- AUTO:END -->

<!-- AUTO:BEGIN name=plan.tasks -->
-
  id: U-sample-update
  refs:
    - ui-spec:sample
  outputs:
    - frontend/src
  acceptance:
    max_changed_lines: 80
    checks:
      - name: frontend-tsc
        command: run tsc
  gate:
    []
  deps:
    []
  risk: 低
  rollback: revert
<!-- AUTO:END -->
"""


WORKORDER_TEMPLATE = """# Workorder

<!-- AUTO:BEGIN name=workorder.meta -->
- plan_snapshot_id:
- Doc ID:
- Updated at:
- Tasks: []
<!-- AUTO:END -->

<!-- AUTO:BEGIN name=workorder.limits -->
{}
<!-- AUTO:END -->

<!-- AUTO:BEGIN name=workorder.allowed_paths -->
[]
<!-- AUTO:END -->

<!-- AUTO:BEGIN name=workorder.blocked_paths -->
[]
<!-- AUTO:END -->

<!-- AUTO:BEGIN name=workorder.plan_links -->
{}
<!-- AUTO:END -->
"""


def _create_repo(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> tuple[Path, Path, Path]:
    root = tmp_path / "repo"
    plan_dir = root / "docs" / "agile"
    plan_dir.mkdir(parents=True)

    plan_path = plan_dir / "plan.md"
    workorder_path = plan_dir / "workorder.md"
    plan_path.write_text(PLAN_TEMPLATE, encoding="utf-8")
    workorder_path.write_text(WORKORDER_TEMPLATE, encoding="utf-8")

    sync_plan = root / "workorder_sync_plan.json"
    doc_sync_plan = root / "doc_sync_plan.json"
    doc_sync_plan.write_text("{}", encoding="utf-8")

    monkeypatch.setattr(workorder_cli, "ROOT", root)
    monkeypatch.setattr(workorder_cli, "PLAN_PATH", plan_path)
    monkeypatch.setattr(workorder_cli, "WORKORDER_PATH", workorder_path)
    monkeypatch.setattr(workorder_cli, "WORKORDER_SYNC_PLAN_PATH", sync_plan)
    monkeypatch.setattr(workorder_cli.plan_cli, "DOC_SYNC_PLAN_PATH", doc_sync_plan)
    monkeypatch.setattr(
        workorder_cli.plan_cli,
        "load_preflight",
        lambda: object(),
    )
    sample_task = {
        "id": "U-sample-update",
        "refs": ["ui-spec:sample"],
        "outputs": ["frontend/src"],
        "acceptance": {
            "max_changed_lines": 80,
            "checks": [
                {"name": "frontend-tsc", "command": "run tsc"},
            ],
        },
        "gate": [],
        "deps": [],
        "risk": "低",
        "rollback": "revert",
    }
    monkeypatch.setattr(
        workorder_cli.plan_cli,
        "build_tasks",
        lambda _data: [sample_task],
    )
    monkeypatch.setattr(docsync_utils, "ROOT", root)

    for key in [
        "WORKORDER_ALLOWED_PATHS",
        "WORKORDER_BLOCKED_PATHS",
        "WORKORDER_MAX_TASK_LINES",
        "WORKORDER_MAX_PR_LINES",
        "WORKORDER_MAX_FILE_LINES",
        "WORKORDER_MAX_TOTAL_LINES",
        "WORKORDER_MAX_LINES_PER_ITER",
        "WORKORDER_MAX_ITERATIONS",
        "WORKORDER_MAX_CHANGED_FILES",
        "WORKORDER_MAX_AUTO_PRS",
    ]:
        monkeypatch.delenv(key, raising=False)

    return root, plan_path, workorder_path


def _init_git_repo(root: Path) -> None:
    subprocess.run(["git", "init"], cwd=root, check=True, capture_output=True)
    subprocess.run(["git", "checkout", "-b", "docs-sync/plan"], cwd=root, check=True, capture_output=True)
    subprocess.run(["git", "config", "user.name", "Codex Tester"], cwd=root, check=True, capture_output=True)
    subprocess.run(["git", "config", "user.email", "codex@example.com"], cwd=root, check=True, capture_output=True)
    subprocess.run(["git", "add", "."], cwd=root, check=True, capture_output=True)
    subprocess.run(["git", "commit", "-m", "init"], cwd=root, check=True, capture_output=True)


def test_ready_updates_workorder_and_json(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    root, _, workorder_path = _create_repo(monkeypatch, tmp_path)

    workorder_cli.cmd_ready(argparse.Namespace())

    text = workorder_path.read_text(encoding="utf-8")
    block = docsync_utils.extract_auto_block(text, "workorder.meta")
    assert re.search(r"-\s*plan_snapshot_id:\s*SNAP123", block)
    assert re.search(r"id:\s*U-sample-update", block)

    limits_block = docsync_utils.extract_auto_block(text, "workorder.limits")
    assert "per_pr: 120" in limits_block
    assert "per_file: 80" in limits_block

    allowed_block = docsync_utils.extract_auto_block(text, "workorder.allowed_paths")
    assert "frontend/src/**" in allowed_block
    assert "docs/agile/workorder.md" in allowed_block

    blocked_block = docsync_utils.extract_auto_block(text, "workorder.blocked_paths")
    assert "alembic/**" in blocked_block

    plan_links_block = docsync_utils.extract_auto_block(text, "workorder.plan_links")
    assert "plan_snapshot_id: SNAP123" in plan_links_block
    assert "id: U-sample-update" in plan_links_block

    data = json.loads((root / "workorder_sync_plan.json").read_text(encoding="utf-8"))
    assert data["plan_snapshot_id"] == "SNAP123"
    assert data["task_ids"] == ["U-sample-update"]
    assert data["limits"]["max_changed_lines"]["per_pr"] == 120
    assert "frontend/src/**" in data["allowed_paths"]
    assert "workorder_sync_plan.json" in data["allowed_paths"]
    assert data["plan_links"]["plan_snapshot_id"] == "SNAP123"


def test_validate_passes_when_synced(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    _create_repo(monkeypatch, tmp_path)
    workorder_cli.cmd_ready(argparse.Namespace())

    workorder_cli.cmd_validate(argparse.Namespace())
    captured = capsys.readouterr()
    assert "docs/agile/workorder.md: OK" in captured.out


def test_validate_detects_missing_task(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    _, _, workorder_path = _create_repo(monkeypatch, tmp_path)
    workorder_cli.cmd_ready(argparse.Namespace())

    text = workorder_path.read_text(encoding="utf-8")
    updated = text.replace("id: U-sample-update", "id: U-other")
    workorder_path.write_text(updated, encoding="utf-8")

    with pytest.raises(SystemExit):
        workorder_cli.cmd_validate(argparse.Namespace())


def test_validate_detects_snapshot_mismatch(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    _, _, workorder_path = _create_repo(monkeypatch, tmp_path)
    workorder_cli.cmd_ready(argparse.Namespace())

    text = workorder_path.read_text(encoding="utf-8")
    updated = text.replace("plan_snapshot_id: SNAP123", "plan_snapshot_id: OTHER456")
    workorder_path.write_text(updated, encoding="utf-8")

    with pytest.raises(SystemExit):
        workorder_cli.cmd_validate(argparse.Namespace())


def test_pr_creates_commit_and_body_file(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    root, _, _ = _create_repo(monkeypatch, tmp_path)
    _init_git_repo(root)

    monkeypatch.setattr(workorder_cli.workorder_guard, "ROOT", root)
    monkeypatch.setattr(
        workorder_cli.workorder_guard,
        "WORKORDER_SYNC_PLAN_PATH",
        root / "workorder_sync_plan.json",
    )

    workorder_cli.cmd_ready(argparse.Namespace())
    capsys.readouterr()  # clear ready output

    args = argparse.Namespace(
        base="docs-sync/plan",
        head="docs-sync/workorder",
        no_push=True,
        no_pr=True,
        allow_dirty=False,
    )
    workorder_cli.cmd_pr(args)
    out = capsys.readouterr().out
    assert "Implementation Draft PR を準備しました。" in out
    assert "plan_snapshot_id: SNAP123" in out

    current_branch = subprocess.run(
        ["git", "branch", "--show-current"],
        cwd=root,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    assert current_branch == "docs-sync/workorder"

    commit_message = subprocess.run(
        ["git", "log", "-1", "--pretty=%s"],
        cwd=root,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    assert commit_message == workorder_cli.COMMIT_MESSAGE

    body_path = root / "tmp" / "workorder_pr_body.md"
    assert body_path.exists()
    body_text = body_path.read_text(encoding="utf-8")
    assert "plan_snapshot_id: SNAP123" in body_text
    assert "U-sample-update" in body_text


def test_pr_skips_when_no_changes(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    root, _, _ = _create_repo(monkeypatch, tmp_path)
    _init_git_repo(root)

    monkeypatch.setattr(workorder_cli.workorder_guard, "ROOT", root)
    monkeypatch.setattr(
        workorder_cli.workorder_guard,
        "WORKORDER_SYNC_PLAN_PATH",
        root / "workorder_sync_plan.json",
    )

    workorder_cli.cmd_ready(argparse.Namespace())
    subprocess.run(
        ["git", "add", "docs/agile/workorder.md", "workorder_sync_plan.json"],
        cwd=root,
        check=True,
        capture_output=True,
    )
    subprocess.run(
        ["git", "commit", "-m", "sync workorder"],
        cwd=root,
        check=True,
        capture_output=True,
    )
    capsys.readouterr()

    args = argparse.Namespace(
        base="docs-sync/plan",
        head="docs-sync/workorder",
        no_push=True,
        no_pr=True,
        allow_dirty=False,
    )
    workorder_cli.cmd_pr(args)
    out = capsys.readouterr().out
    assert "差分" in out
    assert "ありません" in out


def test_pr_requires_clean_tree(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    root, _, _ = _create_repo(monkeypatch, tmp_path)
    _init_git_repo(root)

    monkeypatch.setattr(workorder_cli.workorder_guard, "ROOT", root)
    monkeypatch.setattr(
        workorder_cli.workorder_guard,
        "WORKORDER_SYNC_PLAN_PATH",
        root / "workorder_sync_plan.json",
    )

    workorder_cli.cmd_ready(argparse.Namespace())
    (root / "README-dirty.md").write_text("dirty", encoding="utf-8")

    args = argparse.Namespace(
        base="docs-sync/plan",
        head="docs-sync/workorder",
        no_push=True,
        no_pr=True,
        allow_dirty=False,
    )
    with pytest.raises(SystemExit) as excinfo:
        workorder_cli.cmd_pr(args)

    assert "作業ツリー" in str(excinfo.value)
