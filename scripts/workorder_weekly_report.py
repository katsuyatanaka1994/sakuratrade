#!/usr/bin/env python3
"""Workorder weekly telemetry collector.

Fetches recent `workorder-ready` workflow runs, downloads guard artifacts,
extracts key metrics, and writes a Markdown summary plus a short digest snippet
for PR comments. Focuses on surfaced KPIs: No-Op rate, guard limit hits, and
average lead time.

The script talks to the GitHub REST API but keeps aggregation/test logic pure so
unit tests can exercise it without network calls.
"""

from __future__ import annotations

import argparse
import dataclasses
import datetime as dt
import io
import json
import os
import sys
import typing as t
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from collections import Counter
from pathlib import Path

# ---------------------------------------------------------------------------
# Helpers

ISO_ZERO = dt.datetime.fromtimestamp(0, dt.timezone.utc)
JST = dt.timezone(dt.timedelta(hours=9))


class GithubApiError(RuntimeError):
    """Raised when the GitHub API returns an error response."""


@dataclasses.dataclass
class RunTelemetry:
    run_id: int
    html_url: str
    event: str
    head_branch: str
    actor: str
    conclusion: str | None
    created_at: dt.datetime
    run_started_at: dt.datetime | None
    updated_at: dt.datetime | None
    duration_seconds: int | None
    no_op: bool | None
    guard_status: str | None
    guard_hit: str | None
    limit_hit: bool
    failure_reason: str | None
    data_status: str
    report: dict[str, t.Any] | None
    steps: list[dict[str, t.Any]]


@dataclasses.dataclass
class Summary:
    window_start: dt.datetime
    window_end: dt.datetime
    runs_considered: list[RunTelemetry]
    runs_excluded: list[RunTelemetry]
    success_count: int
    failure_count: int
    cancelled_count: int
    no_op_count: int
    limit_hit_count: int
    avg_lead_time_seconds: float | None
    failure_reasons: list[tuple[str, int]]


# ---------------------------------------------------------------------------
# Time utilities


def _parse_timestamp(raw: str | None) -> dt.datetime | None:
    if not raw:
        return None
    raw = raw.strip()
    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"
    try:
        return dt.datetime.fromisoformat(raw)
    except ValueError:
        return None


def _seconds_between(start: dt.datetime | None, end: dt.datetime | None) -> int | None:
    if not start or not end:
        return None
    delta = end - start
    return int(delta.total_seconds()) if delta.total_seconds() >= 0 else None


def _format_duration(seconds: float | int | None) -> str:
    if seconds is None:
        return "-"
    total = int(round(seconds))
    minutes, sec = divmod(total, 60)
    hours, minutes = divmod(minutes, 60)
    parts: list[str] = []
    if hours:
        parts.append(f"{hours}h")
    if minutes:
        parts.append(f"{minutes}m")
    if not parts:
        parts.append(f"{sec}s")
    else:
        parts.append(f"{sec}s")
    return " ".join(parts)


def _format_date_range(start: dt.datetime, end: dt.datetime, *, tz: dt.tzinfo = JST) -> str:
    start_local = start.astimezone(tz)
    end_local = end.astimezone(tz)
    return f"{start_local.strftime('%Y-%m-%d %H:%M %Z')} — {end_local.strftime('%Y-%m-%d %H:%M %Z')}"


# ---------------------------------------------------------------------------
# GitHub API helpers


def _build_request(url: str, token: str, *, accept: str = "application/vnd.github+json") -> urllib.request.Request:
    req = urllib.request.Request(url)
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Accept", accept)
    req.add_header("User-Agent", "workorder-weekly-report")
    return req


def _github_json(url: str, token: str) -> dict[str, t.Any]:
    req = _build_request(url, token)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            payload = resp.read()
    except urllib.error.HTTPError as exc:
        error = GithubApiError(
            f"GitHub API error {exc.code} for {url}: {exc.read().decode('utf-8', 'ignore')}"
        )
        error.status_code = exc.code  # type: ignore[attr-defined]
        raise error from exc
    except urllib.error.URLError as exc:  # pragma: no cover - network issues
        raise GithubApiError(f"Network error calling {url}: {exc}") from exc
    try:
        return json.loads(payload.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise GithubApiError(f"Invalid JSON from {url}: {exc}") from exc


class _NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(  # pragma: no cover - very small helper
        self,
        request: urllib.request.Request,
        fp,
        code,
        msg,
        headers,
        newurl,
    ):
        return None


def _download_artifact(url: str, token: str) -> bytes:
    parsed = urllib.parse.urlparse(url)
    if parsed.netloc.endswith("actions.githubusercontent.com") or parsed.netloc.endswith("blob.core.windows.net"):
        req = urllib.request.Request(url)
        req.add_header("User-Agent", "workorder-weekly-report")
    else:
        req = _build_request(url, token, accept="application/vnd.github+json")

    opener = urllib.request.build_opener(_NoRedirectHandler())

    try:
        with opener.open(req, timeout=30) as resp:
            return resp.read()
    except urllib.error.HTTPError as exc:
        if exc.code in {301, 302, 303, 307, 308}:
            location = exc.headers.get("Location")
            if location:
                return _download_artifact(location, token)
        raise GithubApiError(
            f"Failed to download artifact {url}: {exc.read().decode('utf-8', 'ignore')}"
        ) from exc
    except urllib.error.URLError as exc:  # pragma: no cover - network issues
        raise GithubApiError(f"Network error downloading artifact {url}: {exc}") from exc


def _load_workorder_report(archive: bytes) -> dict[str, t.Any] | None:
    with zipfile.ZipFile(io.BytesIO(archive)) as zf:
        candidates = [name for name in zf.namelist() if name.endswith(".json")]
        if not candidates:
            return None
        preferred = next(
            (c for c in candidates if c.endswith("workorder_limits_report.json")),
            candidates[0],
        )
        with zf.open(preferred) as fp:
            try:
                return json.load(fp)
            except json.JSONDecodeError:
                return None


def _fetch_jobs(api_url: str, token: str, workflow_run_id: int) -> list[dict[str, t.Any]]:
    url = f"{api_url}/actions/runs/{workflow_run_id}/jobs?per_page=100"
    data = _github_json(url, token)
    return data.get("jobs", [])


def _fetch_workorder_artifact(
    api_url: str,
    token: str,
    workflow_run_id: int,
) -> dict[str, t.Any] | None:
    url = f"{api_url}/actions/runs/{workflow_run_id}/artifacts?per_page=100"
    data = _github_json(url, token)
    for artifact in data.get("artifacts", []):
        if artifact.get("expired"):
            continue
        if artifact.get("name") == "workorder-limits-report":
            archive_url = artifact.get("archive_download_url")
            if not archive_url:
                continue
            archive = _download_artifact(archive_url, token)
            return _load_workorder_report(archive)
    return None


# ---------------------------------------------------------------------------
# Classification helpers


def _normalize_step(name: str) -> str:
    cleaned = name.replace("/", " ")
    cleaned = " ".join(cleaned.strip().lower().split())
    return cleaned


def _classify_guard(
    report: dict[str, t.Any] | None,
) -> tuple[str | None, str | None, bool, bool | None]:
    if not isinstance(report, dict):
        return None, None, False, None
    status = report.get("status")
    guard_hit = None
    limit_hit = False
    if status == "blocked_paths":
        guard_hit = "guard_blocked_paths"
    elif status == "disallowed":
        guard_hit = "guard_disallowed_paths"
    elif status == "limit_exceeded":
        guard_hit = "guard_limit"
        limit_hit = True
    elif status == "pr_ceiling":  # safety: future-proof mapping
        guard_hit = "guard_pr_ceiling"
    no_op_raw = report.get("no_op")
    if no_op_raw is None and status == "no_changes":
        no_op_raw = True
    no_op: bool | None
    if no_op_raw is None:
        no_op = None
    else:
        no_op = bool(no_op_raw)
    if not limit_hit and status == "limit_exceeded":
        limit_hit = True
    if not limit_hit and isinstance(report.get("file_over_limit"), list):
        limit_hit = bool(report.get("file_over_limit"))
    return status, guard_hit, limit_hit, no_op


def _classify_failure(
    conclusion: str | None,
    steps: list[dict[str, t.Any]],
    guard_hit: str | None,
) -> str | None:
    if conclusion != "failure":
        return None
    for step in steps:
        if step.get("conclusion") != "failure":
            continue
        name = _normalize_step(step.get("name", ""))
        if name == "handle guard outcome" and guard_hit:
            return guard_hit
        if name == "enforce automation pr ceiling":
            return "guard_pr_ceiling"
        if name == "run workorder guard" and guard_hit:
            return guard_hit
        if name == "prepare guard script":
            return "guard_prepare_failed"
        if name == "sync workorder metadata":
            return "sync_failed"
        if name == "create update workorder pr":
            return "pr_sync_failed"
        if name == "create github app token":
            return "auth_failed"
        if name == "checkout target revision":
            return "checkout_failed"
        if name == "resolve run context":
            return "context_failed"
        return name.replace(" ", "_") or "failure_unknown"
    return guard_hit or "failure_unknown"


# ---------------------------------------------------------------------------
# Run collection


def _expand_workflow_identifiers(workflow_name: str) -> list[str]:
    path_obj = Path(workflow_name or "workorder-ready.yml")
    stem = path_obj.stem

    candidates: list[str] = []

    def add(candidate: str) -> None:
        if candidate and candidate not in candidates:
            candidates.append(candidate)

    add(f"{stem}.yml")
    add(f"{stem}.yaml")

    return candidates if candidates else ["workorder-ready.yml"]


def collect_runs(
    api_root: str,
    token: str,
    workflow_path: str,
    *,
    repo: str,
    window_start: dt.datetime,
) -> list[RunTelemetry]:
    owner, repo_name = repo.split("/", 1)

    base_path = workflow_path or "workorder-ready.yml"
    path_obj = Path(base_path)
    if path_obj.suffix.lower() == ".yaml":
        path_obj = path_obj.with_suffix(".yml")
    normalized_name = path_obj.name

    runs: list[RunTelemetry] = []
    page = 1
    stop_fetching = False
    workflow_ids = _expand_workflow_identifiers(normalized_name)

    resolved_workflow: str | None = None
    first_payload: dict[str, t.Any] | None = None
    for candidate in workflow_ids:
        url = (
            f"{api_root}/repos/{owner}/{repo_name}/actions/workflows/{candidate}/runs"
            f"?status=completed&per_page=100&page=1"
        )
        try:
            candidate_payload = _github_json(url, token)
        except GithubApiError as exc:
            if getattr(exc, "status_code", None) == 404:
                continue
            raise
        resolved_workflow = candidate
        first_payload = candidate_payload
        break

    if resolved_workflow is None or first_payload is None:
        raise GithubApiError(f"Unable to resolve workflow identifier for {workflow_path!r}")

    payload: dict[str, t.Any] | None = first_payload
    while not stop_fetching:
        if payload is None:
            url = (
                f"{api_root}/repos/{owner}/{repo_name}/actions/workflows/{resolved_workflow}/runs"
                f"?status=completed&per_page=100&page={page}"
            )
            payload = _github_json(url, token)
        for item in payload.get("workflow_runs", []):
            created = _parse_timestamp(item.get("created_at")) or ISO_ZERO
            if created < window_start:
                stop_fetching = True
                break
            run_id = item.get("id")
            html_url = item.get("html_url", "")
            event = item.get("event", "")
            branch = item.get("head_branch", "")
            actor = (item.get("actor") or {}).get("login", "")
            conclusion = item.get("conclusion")
            started = _parse_timestamp(item.get("run_started_at"))
            completed = _parse_timestamp(item.get("updated_at"))
            duration = _seconds_between(started, completed)

            api_base = f"{api_root}/repos/{owner}/{repo_name}"

            steps: list[dict[str, t.Any]] = []
            report: dict[str, t.Any] | None = None
            data_status = "ok"
            try:
                jobs = _fetch_jobs(api_base, token, run_id)
                if jobs:
                    primary = next((j for j in jobs if j.get("name") == item.get("name")), jobs[0])
                    steps = primary.get("steps", [])
                else:
                    data_status = "missing_jobs"
                report = _fetch_workorder_artifact(api_base, token, run_id)
                if report is None:
                    data_status = "missing_artifact"
            except GithubApiError as exc:
                print(f"::warning::Failed to fetch telemetry for run {run_id}: {exc}")
                data_status = "api_error"

            guard_status, guard_hit, limit_hit, no_op = _classify_guard(report)
            failure_reason = _classify_failure(conclusion, steps, guard_hit)

            runs.append(
                RunTelemetry(
                    run_id=run_id,
                    html_url=html_url,
                    event=event,
                    head_branch=branch,
                    actor=actor,
                    conclusion=conclusion,
                    created_at=created,
                    run_started_at=started,
                    updated_at=completed,
                    duration_seconds=duration,
                    no_op=no_op,
                    guard_status=guard_status,
                    guard_hit=guard_hit,
                    limit_hit=limit_hit,
                    failure_reason=failure_reason,
                    data_status=data_status,
                    report=report,
                    steps=steps,
                )
            )
        if stop_fetching or not payload.get("workflow_runs"):
            break
        page += 1
        payload = None
    return runs


# ---------------------------------------------------------------------------
# Aggregation & rendering


def summarise_runs(
    runs: list[RunTelemetry],
    *,
    window_start: dt.datetime,
    window_end: dt.datetime,
) -> Summary:
    considered = [r for r in runs if r.data_status == "ok"]
    excluded = [r for r in runs if r.data_status != "ok"]

    success = sum(1 for r in considered if r.conclusion == "success")
    failure = sum(1 for r in considered if r.conclusion == "failure")
    cancelled = sum(1 for r in considered if r.conclusion == "cancelled")
    no_op = sum(1 for r in considered if r.no_op is True)
    limit_hits = sum(1 for r in considered if r.limit_hit)

    lead_times = [r.duration_seconds for r in considered if r.duration_seconds is not None]
    avg_lead = (sum(lead_times) / len(lead_times)) if lead_times else None

    failure_counter: Counter[str] = Counter(r.failure_reason for r in considered if r.failure_reason)
    failure_top = failure_counter.most_common(3)

    return Summary(
        window_start=window_start,
        window_end=window_end,
        runs_considered=considered,
        runs_excluded=excluded,
        success_count=success,
        failure_count=failure,
        cancelled_count=cancelled,
        no_op_count=no_op,
        limit_hit_count=limit_hits,
        avg_lead_time_seconds=avg_lead,
        failure_reasons=failure_top,
    )


def _render_failure_list(failure_reasons: list[tuple[str, int]]) -> str:
    if not failure_reasons:
        return "-"
    return ", ".join(f"{name} ({count})" for name, count in failure_reasons)


def render_markdown(summary: Summary) -> str:
    period = _format_date_range(summary.window_start, summary.window_end)
    total_runs = len(summary.runs_considered)
    success = summary.success_count
    failure = summary.failure_count
    cancelled = summary.cancelled_count
    noop_rate = (
        f"{summary.no_op_count}/{total_runs} ({(summary.no_op_count / total_runs) * 100:.1f}%)"
        if total_runs
        else "0/0"
    )
    limit_ratio = (
        f"{summary.limit_hit_count}/{total_runs} ({(summary.limit_hit_count / total_runs) * 100:.1f}%)"
        if total_runs
        else "0/0"
    )
    lead_time = _format_duration(summary.avg_lead_time_seconds)
    failures = _render_failure_list(summary.failure_reasons)

    lines = [
        "# Workorder Weekly Report",
        "",
        f"**Period:** {period}",
        "",
        "| Metric | Value |",
        "| --- | --- |",
        f"| Runs analysed | {total_runs} (success {success} / failure {failure} / cancelled {cancelled}) |",
        f"| No-Op rate | {noop_rate} |",
        f"| Limit hits | {limit_ratio} |",
        f"| Avg lead time | {lead_time} |",
        f"| Top failures | {failures} |",
    ]

    if summary.runs_excluded:
        reasons = Counter(r.data_status for r in summary.runs_excluded)
        excluded_str = ", ".join(f"{status}: {count}" for status, count in sorted(reasons.items()))
        lines.extend(
            [
                "",
                f"_Excluded runs (not enough data): {excluded_str}_",
            ]
        )

    if summary.runs_considered:
        lines.extend(
            [
                "",
                "| Run | Trigger | Branch | Conclusion | Lead | No-Op | Guard | Failure |",
                "| --- | --- | --- | --- | --- | --- | --- | --- |",
            ]
        )
        for run in sorted(summary.runs_considered, key=lambda r: r.created_at, reverse=True)[:10]:
            lead = _format_duration(run.duration_seconds)
            failure_reason = run.failure_reason or "-"
            guard = run.guard_status or "-"
            lines.append(
                "| {run} | {event} | {branch} | {conclusion} | {lead} | {noop} | {guard} | {failure} |".format(
                    run=f"[{run.run_id}]({run.html_url})",
                    event=run.event or "-",
                    branch=run.head_branch or "-",
                    conclusion=run.conclusion or "-",
                    lead=lead,
                    noop="✅" if run.no_op is True else ("➖" if run.no_op is False else "-"),
                    guard=guard,
                    failure=failure_reason,
                )
            )
    else:
        lines.extend(["", "_No eligible workorder-ready runs during this window._"])

    return "\n".join(lines).strip() + "\n"


def render_digest(summary: Summary) -> str:
    total_runs = len(summary.runs_considered)
    if not total_runs:
        return "Workorder週次サマリ: 対象期間の実行データがありませんでした。"
    top_failure = summary.failure_reasons[0][0] if summary.failure_reasons else "failuresなし"
    return (
        "Workorder週次サマリ: {runs}件 (成功{success}/失敗{failure})、"
        "No-Op {noop}、上限ヒット {limit_hits}、平均リードタイム {lead}、主要失敗 {failure_reason}."
    ).format(
        runs=total_runs,
        success=summary.success_count,
        failure=summary.failure_count,
        noop=f"{summary.no_op_count}/{total_runs}",
        limit_hits=f"{summary.limit_hit_count}/{total_runs}",
        lead=_format_duration(summary.avg_lead_time_seconds),
        failure_reason=top_failure,
    )


# ---------------------------------------------------------------------------
# CLI


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate weekly workorder report")
    parser.add_argument(
        "--workflow",
        default="workorder-ready.yml",
        help="Workflow file name/path (default: workorder-ready.yml)",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=7,
        help="Lookback window in days (default: 7)",
    )
    parser.add_argument(
        "--output",
        default="reports/workorder-weekly.md",
        help="Markdown output path",
    )
    parser.add_argument(
        "--digest",
        default="reports/workorder-weekly-digest.txt",
        help="Short digest output path",
    )
    parser.add_argument(
        "--repo",
        default=os.environ.get("GITHUB_REPOSITORY"),
        help="owner/repo (default: env GITHUB_REPOSITORY)",
    )
    parser.add_argument(
        "--api-url",
        default=os.environ.get("GITHUB_API_URL", "https://api.github.com"),
        help="GitHub API base URL",
    )
    parser.add_argument(
        "--token",
        default=os.environ.get("GITHUB_TOKEN"),
        help="GitHub token (default: env GITHUB_TOKEN)",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)

    if not args.repo:
        print("GITHUB_REPOSITORY is required", file=sys.stderr)
        return 2
    if not args.token:
        print("GITHUB_TOKEN is required", file=sys.stderr)
        return 2

    now = dt.datetime.now(dt.timezone.utc)
    window_end = now
    window_start = now - dt.timedelta(days=max(args.days, 1))

    runs = collect_runs(args.api_url, args.token, args.workflow, repo=args.repo, window_start=window_start)
    summary = summarise_runs(runs, window_start=window_start, window_end=window_end)

    markdown = render_markdown(summary)
    digest = render_digest(summary)

    output_path = os.path.abspath(args.output)
    digest_path = os.path.abspath(args.digest)

    for target in (output_path, digest_path):
        directory = os.path.dirname(target)
        if directory and not os.path.exists(directory):
            os.makedirs(directory, exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as fh:
        fh.write(markdown)
    with open(digest_path, "w", encoding="utf-8") as fh:
        fh.write(digest + "\n")

    print(f"wrote report to {output_path}")
    print(f"wrote digest to {digest_path}")
    return 0


if __name__ == "__main__":  # pragma: no cover - CLI entry
    sys.exit(main())
