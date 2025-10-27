from __future__ import annotations

import subprocess
from pathlib import Path

import pytest
from scripts import detect_changed_files

pytestmark = pytest.mark.no_db


def _git(repo: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", "-C", str(repo), *args],
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def _init_repo(tmp_path: Path) -> tuple[Path, str]:
    repo = tmp_path / "repo"
    repo.mkdir()
    _git(repo, "init")
    _git(repo, "config", "user.email", "ci@example.com")
    _git(repo, "config", "user.name", "CI")
    (repo / "docs").mkdir()
    (repo / "docs" / "index.md").write_text("base", encoding="utf-8")
    _git(repo, "add", "docs/index.md")
    _git(repo, "commit", "-m", "base")
    base_sha = _git(repo, "rev-parse", "HEAD")
    return repo, base_sha


def test_detect_changed_files_matches_pattern(tmp_path: Path) -> None:
    repo, base_sha = _init_repo(tmp_path)

    (repo / "docs" / "index.md").write_text("update", encoding="utf-8")
    _git(repo, "commit", "-am", "update docs")

    result = detect_changed_files.detect_changed_files(
        repo=repo,
        base=base_sha,
        head="HEAD",
        patterns=["docs/**"],
    )

    assert result.changed is True
    assert result.files == ["docs/index.md"]


def test_detect_changed_files_ignores_non_matching_paths(tmp_path: Path) -> None:
    repo, base_sha = _init_repo(tmp_path)

    (repo / "README.md").write_text("update", encoding="utf-8")
    _git(repo, "add", "README.md")
    _git(repo, "commit", "-m", "update readme")

    result = detect_changed_files.detect_changed_files(
        repo=repo,
        base=base_sha,
        head="HEAD",
        patterns=["docs/**"],
    )

    assert result.changed is False
    assert result.files == []


def test_cli_emits_github_output(tmp_path: Path) -> None:
    repo, base_sha = _init_repo(tmp_path)

    (repo / "docs" / "guide.md").write_text("content", encoding="utf-8")
    _git(repo, "add", "docs/guide.md")
    _git(repo, "commit", "-m", "add guide")

    output_file = tmp_path / "outputs.txt"
    result = detect_changed_files.main(
        [
            "--repo",
            str(repo),
            "--base",
            base_sha,
            "--head",
            "HEAD",
            "--patterns",
            "docs/**",
            "--github-output",
            str(output_file),
            "--output-prefix",
            "docs_",
        ]
    )

    assert result.changed is True
    assert "docs_changed=true" in output_file.read_text(encoding="utf-8")
