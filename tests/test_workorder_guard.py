from __future__ import annotations

import pytest
from scripts import workorder_guard

pytestmark = pytest.mark.no_db


def _limits(overrides: dict | None = None) -> dict:
    base: dict = {
        "max_changed_lines": {"per_file": 80, "per_pr": 120},
        "max_total_changed_lines": 180,
        "max_changed_files": 6,
    }
    if overrides:
        base.update(overrides)
    return base


def test_evaluate_guard_ok() -> None:
    stats = {
        "files": [{"path": "frontend/src/App.tsx", "total": 10, "added": 6, "deleted": 4}],
        "file_count": 1,
        "total_lines": 10,
    }
    result = workorder_guard.evaluate_guard(stats, ["frontend/src/**"], [], _limits())
    assert result["status"] == "ok"
    assert not result["disallowed_files"]
    assert not result["blocked_files"]


def test_evaluate_guard_disallowed() -> None:
    stats = {
        "files": [{"path": "backend/app.py", "total": 20, "added": 10, "deleted": 10}],
        "file_count": 1,
        "total_lines": 20,
    }
    result = workorder_guard.evaluate_guard(stats, ["frontend/src/**"], [], _limits())
    assert result["status"] == "disallowed"
    assert result["disallowed_files"] == ["backend/app.py"]


def test_evaluate_guard_blocked() -> None:
    stats = {
        "files": [{"path": "infra/terraform.tf", "total": 5, "added": 5, "deleted": 0}],
        "file_count": 1,
        "total_lines": 5,
    }
    result = workorder_guard.evaluate_guard(stats, ["frontend/src/**"], ["infra/**"], _limits())
    assert result["status"] == "blocked_paths"
    assert result["blocked_files"] == ["infra/terraform.tf"]


def test_evaluate_guard_file_limit() -> None:
    stats = {
        "files": [{"path": "frontend/src/App.tsx", "total": 200, "added": 180, "deleted": 20}],
        "file_count": 1,
        "total_lines": 200,
    }
    result = workorder_guard.evaluate_guard(stats, ["frontend/src/**"], [], _limits())
    assert result["status"] == "limit_exceeded"
    assert result["file_over_limit"]


def test_evaluate_guard_total_limit() -> None:
    stats = {
        "files": [
            {"path": "frontend/src/App.tsx", "total": 90, "added": 70, "deleted": 20},
            {"path": "frontend/src/View.tsx", "total": 95, "added": 60, "deleted": 35},
        ],
        "file_count": 2,
        "total_lines": 185,
    }
    result = workorder_guard.evaluate_guard(stats, ["frontend/src/**"], [], _limits())
    assert result["status"] == "limit_exceeded"
    assert result["total_over_limit"] is True


def test_evaluate_guard_file_count_limit() -> None:
    stats = {
        "files": [
            {"path": f"frontend/src/Comp{i}.tsx", "total": 10, "added": 6, "deleted": 4}
            for i in range(7)
        ],
        "file_count": 7,
        "total_lines": 70,
    }
    result = workorder_guard.evaluate_guard(stats, ["frontend/src/**"], [], _limits())
    assert result["status"] == "limit_exceeded"
    assert result["file_count_over_limit"] is True


def test_evaluate_guard_no_changes() -> None:
    stats = {"files": [], "file_count": 0, "total_lines": 0}
    result = workorder_guard.evaluate_guard(stats, ["frontend/src/**"], [], _limits())
    assert result["status"] == "no_changes"
