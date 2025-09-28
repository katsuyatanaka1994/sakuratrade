#!/usr/bin/env python3
"""Fail the build when project modules are imported without the `app.` prefix."""

from __future__ import annotations

import ast
import sys
from pathlib import Path
from typing import Iterable

PROJECT_ROOT = Path(__file__).resolve().parents[1]
APP_ROOT = PROJECT_ROOT / "app"

# Directories / files to scan for improper imports.
SCAN_TARGETS: list[Path] = [APP_ROOT, PROJECT_ROOT / "tests", PROJECT_ROOT / "alembic"]
SCAN_TARGETS.extend(PROJECT_ROOT.glob("test_*.py"))


def iter_python_files(paths: Iterable[Path]) -> Iterable[Path]:
    for path in paths:
        if not path.exists():
            continue
        if path.is_file() and path.suffix == ".py":
            yield path
        elif path.is_dir():
            for py_file in path.rglob("*.py"):
                if "__pycache__" in py_file.parts:
                    continue
                yield py_file


def collect_app_modules() -> set[str]:
    modules: set[str] = {"app"}
    for path in APP_ROOT.iterdir():
        if path.name.startswith("__"):
            continue
        if path.is_dir():
            modules.add(path.name)
        elif path.suffix == ".py":
            modules.add(path.stem)
    return modules


def is_violation(module_name: str | None, *, project_modules: set[str]) -> bool:
    if not module_name:
        return False
    root = module_name.split(".")[0]
    if root == "app":
        return False
    return root in project_modules


def find_illegal_imports(py_file: Path, project_modules: set[str]) -> list[str]:
    violations: list[str] = []
    try:
        tree = ast.parse(py_file.read_text(encoding="utf-8"))
    except Exception as exc:  # pragma: no cover - surfaced via CI logs
        violations.append(f"{py_file}:1: failed to parse Python file ({exc})")
        return violations

    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom):
            if node.level and node.module:
                # `from ..core import foo` style
                violations.append(f"{py_file}:{node.lineno}: relative import detected (use absolute app.* imports)")
                continue
            if node.level and not node.module:
                violations.append(f"{py_file}:{node.lineno}: relative import detected (use absolute app.* imports)")
                continue
            if is_violation(node.module, project_modules=project_modules):
                violations.append(f"{py_file}:{node.lineno}: import from '{node.module}' must be prefixed with 'app.'")
        elif isinstance(node, ast.Import):
            for alias in node.names:
                if is_violation(alias.name, project_modules=project_modules):
                    violations.append(f"{py_file}:{node.lineno}: import '{alias.name}' must use the 'app.' prefix")
    return violations


def main() -> int:
    project_modules = collect_app_modules()
    violations: list[str] = []

    for py_file in iter_python_files(SCAN_TARGETS):
        violations.extend(find_illegal_imports(py_file, project_modules=project_modules))

    if violations:
        for message in sorted(set(violations)):
            print(message)
        print(
            "Import validation failed. Ensure intra-project imports use 'from app.<module> import ...'.",
            file=sys.stderr,
        )
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
