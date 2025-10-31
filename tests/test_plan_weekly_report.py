import datetime as dt

from scripts.plan_weekly_report import (
    RunTelemetry,
    summarise_runs,
    render_markdown,
    render_digest,
)


def _run(**kwargs):
    now = dt.datetime(2025, 1, 1, 0, 0, tzinfo=dt.timezone.utc)
    base = dict(
        run_id=1,
        html_url="https://example.com",
        event="pull_request",
        head_branch="feature/test",
        actor="codex",
        conclusion="success",
        created_at=now,
        run_started_at=now,
        updated_at=now + dt.timedelta(minutes=3),
        duration_seconds=180,
        no_op=True,
        guard_hit=None,
        failure_reason=None,
        data_status="ok",
        report={"preflight": {"no_op": True}},
        steps=[],
    )
    base.update(kwargs)
    return RunTelemetry(**base)


def test_summarise_runs_counts_and_lead_time():
    window_start = dt.datetime(2024, 12, 25, tzinfo=dt.timezone.utc)
    window_end = dt.datetime(2025, 1, 1, tzinfo=dt.timezone.utc)

    runs = [
        _run(run_id=101, no_op=True, conclusion="success", duration_seconds=120),
        _run(
            run_id=102,
            conclusion="failure",
            no_op=False,
            duration_seconds=240,
            guard_hit="guard_line_limit",
            failure_reason="guard_line_limit",
        ),
        _run(run_id=103, data_status="missing_artifact"),
    ]

    summary = summarise_runs(runs, window_start=window_start, window_end=window_end)

    assert len(summary.runs_considered) == 2
    assert summary.success_count == 1
    assert summary.failure_count == 1
    assert summary.no_op_count == 1
    assert summary.avg_lead_time_seconds == (120 + 240) / 2
    assert summary.failure_reasons == [("guard_line_limit", 1)]
    assert summary.runs_excluded[0].run_id == 103

    markdown = render_markdown(summary)
    assert "guard_line_limit (1)" in markdown
    assert "Runs analysed | 2" in markdown

    digest = render_digest(summary)
    assert "2件" in digest
    assert "guard_line_limit" in digest


def test_render_digest_no_runs():
    window_start = dt.datetime(2024, 12, 25, tzinfo=dt.timezone.utc)
    window_end = dt.datetime(2025, 1, 1, tzinfo=dt.timezone.utc)
    summary = summarise_runs([], window_start=window_start, window_end=window_end)
    assert "対象期間の実行データがありません" in render_digest(summary)
