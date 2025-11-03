import datetime as dt

import pytest

from scripts.workorder_weekly_report import (
    RunTelemetry,
    _expand_workflow_identifiers,
    render_digest,
    render_markdown,
    summarise_runs,
)


pytestmark = pytest.mark.no_db


def _run(**kwargs):
    now = dt.datetime(2025, 1, 1, 0, 0, tzinfo=dt.timezone.utc)
    base = dict(
        run_id=1,
        html_url="https://example.com",
        event="workflow_dispatch",
        head_branch="docs-sync/workorder",
        actor="codex",
        conclusion="success",
        created_at=now,
        run_started_at=now,
        updated_at=now + dt.timedelta(minutes=3),
        duration_seconds=180,
        no_op=True,
        guard_status="no_changes",
        guard_hit=None,
        limit_hit=False,
        failure_reason=None,
        data_status="ok",
        report={"status": "no_changes"},
        steps=[],
    )
    base.update(kwargs)
    return RunTelemetry(**base)


def test_summarise_runs_counts_limit_hits_and_lead_time():
    window_start = dt.datetime(2024, 12, 25, tzinfo=dt.timezone.utc)
    window_end = dt.datetime(2025, 1, 1, tzinfo=dt.timezone.utc)

    runs = [
        _run(run_id=101, no_op=True, duration_seconds=120),
        _run(
            run_id=102,
            conclusion="failure",
            no_op=False,
            guard_status="limit_exceeded",
            guard_hit="guard_limit",
            limit_hit=True,
            duration_seconds=240,
            failure_reason="guard_limit",
        ),
        _run(run_id=103, data_status="missing_artifact"),
    ]

    summary = summarise_runs(runs, window_start=window_start, window_end=window_end)

    assert len(summary.runs_considered) == 2
    assert summary.success_count == 1
    assert summary.failure_count == 1
    assert summary.no_op_count == 1
    assert summary.limit_hit_count == 1
    assert summary.avg_lead_time_seconds == (120 + 240) / 2
    assert summary.failure_reasons == [("guard_limit", 1)]
    assert summary.runs_excluded[0].run_id == 103

    markdown = render_markdown(summary)
    assert "Workorder Weekly Report" in markdown
    assert "Limit hits | 1/2" in markdown

    digest = render_digest(summary)
    assert "No-Op 1/2" in digest
    assert "上限ヒット 1/2" in digest


def test_render_digest_no_runs():
    window_start = dt.datetime(2024, 12, 25, tzinfo=dt.timezone.utc)
    window_end = dt.datetime(2025, 1, 1, tzinfo=dt.timezone.utc)
    summary = summarise_runs([], window_start=window_start, window_end=window_end)
    assert "対象期間の実行データがありません" in render_digest(summary)


def test_render_markdown_no_runs():
    window_start = dt.datetime(2024, 12, 25, tzinfo=dt.timezone.utc)
    window_end = dt.datetime(2025, 1, 1, tzinfo=dt.timezone.utc)
    summary = summarise_runs([], window_start=window_start, window_end=window_end)
    markdown = render_markdown(summary)
    assert "No eligible workorder-ready runs" in markdown


def test_expand_workflow_identifiers_supports_yaml_and_yml():
    candidates = _expand_workflow_identifiers(".github/workflows/workorder-ready.yaml")
    assert candidates[0] == "workorder-ready.yml"
    assert "workorder-ready.yaml" in candidates

    yml_candidates = _expand_workflow_identifiers("workorder-ready.yml")
    assert yml_candidates[0] == "workorder-ready.yml"
    assert "workorder-ready.yaml" in yml_candidates
