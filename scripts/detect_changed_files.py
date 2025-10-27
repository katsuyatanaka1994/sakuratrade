"""Shared diff detection helper for GitHub Actions.

The script exposes both a CLI and importable helpers so workflows and
unit tests can share the same logic. It inspects the git diff between a
base and head ref (default: `GITHUB_BASE_REF` vs `HEAD`) and reports
whether any changed files match the provided glob patterns.

Example (GitHub Actions step):

```
python scripts/detect_changed_files.py \
  --base "${{ github.event.pull_request.base.sha }}" \
  --patterns docs/** .github/workflows/docs-index-validate.yml \
  --github-output "$GITHUB_OUTPUT" \
  --summary-title "docs-index diff gate"
```
"""

from __future__ import annotations

import argparse
import fnmatch
import json
import os
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Sequence


@dataclass(frozen=True)
class DetectionResult:
    """Return value for diff detection."""

    changed: bool
    files: List[str]


class GitDiffError(RuntimeError):
    """Raised when git diff could not be computed."""


def _normalize(path: str) -> str:
    """Normalize paths to POSIX style for glob matching."""

    return path.replace("\\", "/")


def _run_git_diff(repo: Path, base: str, head: str) -> list[str]:
    """Return files changed between `base` and `head` using three-dot diff."""

    cmd = ["git", "-C", str(repo), "diff", "--name-only", f"{base}...{head}", "--"]
    try:
        completed = subprocess.run(
            cmd,
            check=True,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError as exc:  # pragma: no cover - defensive path
        raise GitDiffError(
            f"git diff failed for base={base!r} head={head!r}: {exc.stderr or exc}"
        ) from exc

    return [line.strip() for line in completed.stdout.splitlines() if line.strip()]


def _match_files(paths: Iterable[str], patterns: Sequence[str]) -> list[str]:
    """Return subset of `paths` that match any glob in `patterns`."""

    normalized_patterns = [_normalize(pattern) for pattern in patterns]
    matched: list[str] = []
    for path in paths:
        normalized_path = _normalize(path)
        if any(fnmatch.fnmatch(normalized_path, pattern) for pattern in normalized_patterns):
            matched.append(path)
    return matched


def detect_changed_files(
    *, repo: Path | str = Path.cwd(), base: str, head: str = "HEAD", patterns: Sequence[str]
) -> DetectionResult:
    """High level helper used by both the CLI and tests."""

    repo_path = Path(repo)
    changed_files = _run_git_diff(repo_path, base=base, head=head)
    matched = _match_files(changed_files, patterns)
    return DetectionResult(changed=bool(matched), files=matched)


def _write_github_output(result: DetectionResult, output_file: Path, prefix: str) -> None:
    key_prefix = prefix or ""
    with output_file.open("a", encoding="utf-8") as handle:
        handle.write(f"{key_prefix}changed={'true' if result.changed else 'false'}\n")
        handle.write(f"{key_prefix}files<<EOF\n")
        if result.files:
            handle.write("\n".join(result.files) + "\n")
        handle.write("EOF\n")


def _write_json_output(result: DetectionResult, json_file: Path) -> None:
    payload = {"changed": result.changed, "files": result.files}
    json_file.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def _append_summary(result: DetectionResult, summary_file: Path, title: str) -> None:
    summary_file.parent.mkdir(parents=True, exist_ok=True)
    with summary_file.open("a", encoding="utf-8") as handle:
        handle.write(f"## {title}\n")
        if result.changed:
            handle.write(f"- matched files: {len(result.files)}\n")
            for path in result.files:
                handle.write(f"  - `{path}`\n")
        else:
            handle.write("- no matching files; downstream jobs may short-circuit\n")
        handle.write("\n")


def main(argv: Sequence[str] | None = None) -> DetectionResult:
    parser = argparse.ArgumentParser(description="Detect file changes that match given globs")
    parser.add_argument(
        "--repo",
        default=Path.cwd(),
        type=Path,
        help="Path to the git repository (default: current working directory)",
    )
    parser.add_argument(
        "--base",
        default=os.environ.get("GITHUB_BASE_REF") or "origin/main",
        help="Base ref/sha used for the diff (default: $GITHUB_BASE_REF or origin/main)",
    )
    parser.add_argument(
        "--head",
        default=os.environ.get("GITHUB_SHA") or "HEAD",
        help="Head ref/sha used for the diff (default: $GITHUB_SHA or HEAD)",
    )
    parser.add_argument(
        "--patterns",
        nargs="+",
        required=True,
        help="One or more glob patterns to match (e.g. docs/** scripts/*.py)",
    )
    parser.add_argument(
        "--github-output",
        type=Path,
        default=None,
        help="Optional path to $GITHUB_OUTPUT for emitting outputs",
    )
    parser.add_argument(
        "--output-prefix",
        default="",
        help="Optional prefix for output keys, e.g. docs_detect",
    )
    parser.add_argument(
        "--json-output",
        type=Path,
        default=None,
        help="Optional JSON file to capture the result",
    )
    parser.add_argument(
        "--summary-title",
        default="detect-changed-files",
        help="Heading used when appending to $GITHUB_STEP_SUMMARY",
    )

    args = parser.parse_args(argv)

    result = detect_changed_files(
        repo=args.repo,
        base=args.base,
        head=args.head,
        patterns=args.patterns,
    )

    print(
        f"diff result: changed={result.changed} matched_files={len(result.files)} patterns={args.patterns}",
        flush=True,
    )

    if args.github_output:
        _write_github_output(result, args.github_output, args.output_prefix)

    if args.json_output:
        _write_json_output(result, args.json_output)

    step_summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if step_summary:
        _append_summary(result, Path(step_summary), args.summary_title)

    return result


if __name__ == "__main__":
    main()
