import types

import pytest
from scripts import plan_cli


@pytest.mark.no_db
def test_matches_any_patterns():
    patterns = ["docs/agile/**", "docs/specs/**"]
    assert plan_cli._matches_any("docs/agile/plan.md", patterns)
    assert plan_cli._matches_any("docs/specs/openapi.yaml", patterns)
    assert not plan_cli._matches_any("frontend/src/App.tsx", patterns)


@pytest.mark.no_db
def test_collect_diff_stats(monkeypatch):
    stdout = "10\t2\tdocs/agile/plan.md\n-\t-\tdoc_sync_plan.json\n"

    def fake_run(cmd, cwd, capture_output, text, check):
        assert cmd[:3] == ["git", "diff", "--numstat"]
        return types.SimpleNamespace(stdout=stdout, returncode=0)

    monkeypatch.setattr(plan_cli.subprocess, "run", fake_run)

    stats = plan_cli._collect_diff_stats()
    assert stats["file_count"] == 2
    assert stats["total_lines"] == 12
    assert stats["files"][0]["path"] == "docs/agile/plan.md"
    assert stats["files"][0]["added"] == 10
    assert stats["files"][0]["deleted"] == 2
