from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import pytest

from scripts import docsync_utils
from scripts import workorder_cli

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
- Ticket(s):
- Owner(s):
- Due:
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

    return root, plan_path, workorder_path


def test_ready_updates_workorder_and_json(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    root, _, workorder_path = _create_repo(monkeypatch, tmp_path)

    workorder_cli.cmd_ready(argparse.Namespace())

    text = workorder_path.read_text(encoding="utf-8")
    block = docsync_utils.extract_auto_block(text, "workorder.meta")
    assert re.search(r"-\s*plan_snapshot_id:\s*SNAP123", block)
    assert re.search(r"id:\s*U-sample-update", block)

    data = json.loads((root / "workorder_sync_plan.json").read_text(encoding="utf-8"))
    assert data["plan_snapshot_id"] == "SNAP123"
    assert data["task_ids"] == ["U-sample-update"]


def test_validate_passes_when_synced(monkeypatch: pytest.MonkeyPatch, tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    _create_repo(monkeypatch, tmp_path)
    workorder_cli.cmd_ready(argparse.Namespace())

    workorder_cli.cmd_validate(argparse.Namespace())
    captured = capsys.readouterr()
    assert "docs/agile/workorder.md: OK" in captured.out


def test_validate_detects_missing_task(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    _, _, workorder_path = _create_repo(monkeypatch, tmp_path)
    workorder_cli.cmd_ready(argparse.Namespace())

    text = workorder_path.read_text(encoding="utf-8")
    block = docsync_utils.extract_auto_block(text, "workorder.meta")
    updated = text.replace("id: U-sample-update", "id: U-other")
    workorder_path.write_text(updated, encoding="utf-8")

    with pytest.raises(SystemExit):
        workorder_cli.cmd_validate(argparse.Namespace())


def test_validate_detects_snapshot_mismatch(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    _, _, workorder_path = _create_repo(monkeypatch, tmp_path)
    workorder_cli.cmd_ready(argparse.Namespace())

    text = workorder_path.read_text(encoding="utf-8")
    block = docsync_utils.extract_auto_block(text, "workorder.meta")
    updated = text.replace("plan_snapshot_id: SNAP123", "plan_snapshot_id: OTHER456")
    workorder_path.write_text(updated, encoding="utf-8")

    with pytest.raises(SystemExit):
        workorder_cli.cmd_validate(argparse.Namespace())


def test_pr_outputs_summary(monkeypatch: pytest.MonkeyPatch, tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    _create_repo(monkeypatch, tmp_path)
    workorder_cli.cmd_ready(argparse.Namespace())

    workorder_cli.cmd_pr(argparse.Namespace())
    out = capsys.readouterr().out
    assert "plan_snapshot_id" in out
    assert "U-sample-update" in out
    assert "git checkout -B docs-sync/workorder" in out
