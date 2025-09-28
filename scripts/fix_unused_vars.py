#!/usr/bin/env python3
"""Apply safe automatic fixes for Ruff F841 unused local variable warnings.

Usage::

    ruff check --select F841 . --output-format json > ruff.json
    python scripts/fix_unused_vars.py --log ruff.json        # dry run
    python scripts/fix_unused_vars.py --log ruff.json --apply
"""

from __future__ import annotations

import argparse
import ast
import difflib
import io
import json
import re
import shutil
import sys
import tokenize
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List

F841_PATTERN = re.compile(r"^(?P<path>.+?):(?P<line>\d+):(?P<col>\d+):\s*F841\s+[^']*'(?P<name>[^']+)'")


@dataclass
class Issue:
    line: int
    column: int
    name: str
    message: str
    raw: str


@dataclass
class FileFixResult:
    path: Path
    original_lines: List[str]
    updated_lines: List[str]
    modified: bool


def parse_ruff_f841_from_text(stream: Iterable[str]) -> dict[Path, List[Issue]]:
    issues: dict[Path, List[Issue]] = defaultdict(list)
    for raw_line in stream:
        raw_line = raw_line.strip()
        if not raw_line:
            continue
        match = F841_PATTERN.match(raw_line)
        if not match:
            continue
        rel_path = Path(match.group("path")).resolve()
        issue = Issue(
            line=int(match.group("line")),
            column=int(match.group("col")),
            name=match.group("name"),
            message=raw_line,
            raw=raw_line,
        )
        issues[rel_path].append(issue)
    return issues


def _load_json_records(log_text: str) -> list[dict]:
    stripped = log_text.strip()
    if not stripped:
        return []
    try:
        data = json.loads(stripped)
    except json.JSONDecodeError:
        records: list[dict] = []
        for line in log_text.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(obj, dict):
                records.append(obj)
        return records
    else:
        if isinstance(data, list):
            return [item for item in data if isinstance(item, dict)]
        if isinstance(data, dict):
            for key in ("diagnostics", "messages", "results"):
                value = data.get(key)
                if isinstance(value, list):
                    return [item for item in value if isinstance(item, dict)]
            return [data]
        return []


def _extract_var_name_from_message(message: str, record: dict) -> str | None:
    match = re.search(r"`([^`]+)`", message or "")
    if match:
        return match.group(1)
    fallback = record.get("symbol") or record.get("name")
    if isinstance(fallback, str) and fallback:
        return fallback
    return None


def parse_ruff_f841_from_json(log_text: str) -> dict[Path, List[Issue]]:
    issues: dict[Path, List[Issue]] = defaultdict(list)
    records = _load_json_records(log_text)
    for record in records:
        if record.get("code") != "F841":
            continue
        filename = record.get("filename")
        location = record.get("location") or {}
        row = location.get("row")
        column = location.get("column")
        message = record.get("message", "")
        if not filename or row is None or column is None:
            print(
                f"[warn] Incomplete F841 record skipped: {json.dumps(record, ensure_ascii=False)}",
                file=sys.stderr,
            )
            continue
        path = Path(filename).resolve()
        var_name = _extract_var_name_from_message(message, record)
        if not var_name:
            print(
                f"[warn] Could not determine variable name for record: {json.dumps(record, ensure_ascii=False)}",
                file=sys.stderr,
            )
            continue
        issue = Issue(
            line=int(row),
            column=int(column),
            name=var_name,
            message=message,
            raw=json.dumps(record, ensure_ascii=False),
        )
        issues[path].append(issue)
    return issues


def parse_ruff_log(log_text: str) -> dict[Path, List[Issue]]:
    json_issues = parse_ruff_f841_from_json(log_text)
    if json_issues:
        return json_issues
    return parse_ruff_f841_from_text(log_text.splitlines())


def _replace_name_in_line(line: str, name: str, column: int) -> tuple[str, bool]:
    buffer = io.StringIO(line)
    tokens = list(tokenize.generate_tokens(buffer.readline))
    replaced = False
    target_col = column - 1
    updated_tokens: List[tokenize.TokenInfo] = []
    for tok in tokens:
        if tok.type == tokenize.NAME and tok.string == name:
            if tok.start[1] == target_col or (target_col < 0 and not replaced):
                tok = tokenize.TokenInfo(tok.type, "_", tok.start, tok.end, tok.line)
                replaced = True
        updated_tokens.append(tok)
    if not replaced:
        return line, False
    new_line = tokenize.untokenize(updated_tokens)
    if line.endswith("\n") and not new_line.endswith("\n"):
        new_line += "\n"
    return new_line, True


def collect_simple_assignment_positions(source: str) -> set[tuple[int, int, str]]:
    positions: set[tuple[int, int, str]] = set()
    try:
        tree = ast.parse(source)
    except SyntaxError as exc:
        print(f"[warn] Could not parse AST for assignment detection: {exc}", file=sys.stderr)
        return positions

    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    positions.add((target.lineno, target.col_offset, target.id))
        elif isinstance(node, ast.AnnAssign):
            target = node.target
            if isinstance(target, ast.Name):
                positions.add((target.lineno, target.col_offset, target.id))

    return positions


def apply_fixes_for_file(path: Path, issues: List[Issue]) -> FileFixResult:
    original_text = path.read_text(encoding="utf-8")
    original_lines = original_text.splitlines(keepends=True)
    updated_lines = original_lines.copy()
    simple_assignments = collect_simple_assignment_positions(original_text)

    issues_by_line: dict[int, List[Issue]] = defaultdict(list)
    for issue in issues:
        issues_by_line[issue.line].append(issue)

    modified = False
    for line_no, line_issues in issues_by_line.items():
        if line_no <= 0 or line_no > len(updated_lines):
            continue
        line = updated_lines[line_no - 1]
        # Process right-to-left to keep column offsets valid
        for issue in sorted(line_issues, key=lambda i: i.column, reverse=True):
            key = (issue.line, issue.column - 1, issue.name)
            if key not in simple_assignments:
                print(
                    f"[warn] Skipping complex assignment at {path}:{issue.line}:{issue.column} ({issue.message})",
                    file=sys.stderr,
                )
                continue
            line, replaced = _replace_name_in_line(line, issue.name, issue.column)
            if not replaced:
                print(
                    f"[warn] Failed to update {path}:{issue.line}:{issue.column} for {issue.name}",
                    file=sys.stderr,
                )
            modified = modified or replaced
        updated_lines[line_no - 1] = line

    return FileFixResult(path=path, original_lines=original_lines, updated_lines=updated_lines, modified=modified)


def create_backup(path: Path) -> Path:
    backup_path = path.with_suffix(path.suffix + ".bak")
    shutil.copy2(path, backup_path)
    return backup_path


def main() -> int:
    parser = argparse.ArgumentParser(description="Fix Ruff F841 unused-variable warnings.")
    parser.add_argument(
        "--log",
        type=Path,
        help="Path to a Ruff lint log. If omitted, read from stdin.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply the fixes instead of printing a diff only.",
    )
    args = parser.parse_args()

    if args.log:
        if not args.log.exists():
            parser.error(f"Log file not found: {args.log}")
        log_text = args.log.read_text(encoding="utf-8")
    else:
        log_text = sys.stdin.read()

    issues_by_file = parse_ruff_log(log_text)
    if not issues_by_file:
        print("No F841 entries detected in the provided Ruff output.")
        return 0

    exit_code = 0
    for path, issues in issues_by_file.items():
        if not path.exists():
            print(f"[warn] Skipping missing file: {path}", file=sys.stderr)
            continue
        result = apply_fixes_for_file(path, issues)
        if not result.modified:
            continue

        diff = difflib.unified_diff(
            [line if line.endswith("\n") else line + "\n" for line in result.original_lines],
            [line if line.endswith("\n") else line + "\n" for line in result.updated_lines],
            fromfile=str(path),
            tofile=f"{path} (fixed)",
        )
        diff_output = "".join(diff)
        if diff_output:
            print(diff_output, end="")
        else:
            print(f"[warn] No diff produced for {path}", file=sys.stderr)

        if args.apply:
            create_backup(path)
            path.write_text("".join(result.updated_lines), encoding="utf-8")
        else:
            exit_code = 1

    if not args.apply and exit_code == 1:
        print("---\nDry-run complete. Re-run with --apply to write changes.")

    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
