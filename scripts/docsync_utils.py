#!/usr/bin/env python3
"""Shared helpers for DocSync CLI scripts."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent

AUTO_SECTION_PATTERN = re.compile(
    r"(<!--\s*AUTO:BEGIN\s+name=(?P<name>[^\s]+)\s*-->)"
    r"(?P<body>.*?)"
    r"(<!--\s*AUTO:END\s*-->)",
    re.DOTALL,
)


def extract_auto_block(text: str, name: str) -> str:
    """Return raw body text for the specified AUTO section."""

    match = AUTO_SECTION_PATTERN.search(text)
    while match:
        if match.group("name") == name:
            body = match.group("body")
            # Strip leading/trailing whitespace without removing indentation lines completely.
            return body.strip("\n")
        text = text[match.end() :]
        match = AUTO_SECTION_PATTERN.search(text)
    raise ValueError(f"AUTO section {name} not found")


def replace_auto_block(text: str, name: str, body: str) -> str:
    pattern = re.compile(
        rf"<!--\s*AUTO:BEGIN\s+name={re.escape(name)}\s*-->" + r".*?" + r"<!--\s*AUTO:END\s*-->",
        re.DOTALL,
    )
    replacement = f"<!-- AUTO:BEGIN name={name} -->\n{body}\n<!-- AUTO:END -->"
    if not pattern.search(text):
        raise SystemExit(f"AUTO セクション {name} が見つかりません。")
    return pattern.sub(replacement, text)


def _render_dict(value: dict[str, Any], level: int) -> list[str]:
    space = " " * level
    if not value:
        return [f"{space}{{}}"]
    lines: list[str] = []
    for key, val in value.items():
        if isinstance(val, dict):
            if not val:
                lines.append(f"{space}{key}: {{}}")
            else:
                lines.append(f"{space}{key}:")
                lines.extend(_render_dict(val, level + 2))
        elif isinstance(val, list):
            if not val:
                lines.append(f"{space}{key}: []")
            else:
                lines.append(f"{space}{key}:")
                lines.extend(_render_list(val, level + 2))
        else:
            lines.append(f"{space}{key}: {val}")
    return lines


def _render_list(value: list[Any], level: int) -> list[str]:
    space = " " * level
    if not value:
        return [f"{space}[]"]
    lines: list[str] = []
    for item in value:
        if isinstance(item, dict):
            if not item:
                lines.append(f"{space}- {{}}")
                continue
            simple = all(
                (not isinstance(v, (dict, list))) or (isinstance(v, dict) and not v) or (isinstance(v, list) and not v)
                for v in item.values()
            )
            keys = list(item.items())
            head_space = " " * (level + 2)
            if simple:
                first_key, first_val = keys[0]
                lines.append(f"{space}- {first_key}: {first_val}")
                for key, val in keys[1:]:
                    lines.append(f"{head_space}{key}: {val}")
            else:
                if len(keys) == 1 and isinstance(keys[0][1], (dict, list)):
                    key, val = keys[0]
                    lines.append(f"{space}- {key}:")
                    if isinstance(val, dict):
                        lines.extend(_render_dict(val, level + 4))
                    else:
                        lines.extend(_render_list(val, level + 4))
                else:
                    lines.append(f"{space}-")
                    for key, val in keys:
                        if isinstance(val, dict):
                            lines.append(f"{head_space}{key}:")
                            lines.extend(_render_dict(val, level + 4))
                        elif isinstance(val, list):
                            lines.append(f"{head_space}{key}:")
                            lines.extend(_render_list(val, level + 4))
                        else:
                            lines.append(f"{head_space}{key}: {val}")
        elif isinstance(item, list):
            lines.append(f"{space}-")
            lines.extend(_render_list(item, level + 2))
        else:
            lines.append(f"{space}- {item}")
    return lines


def render_yaml_block(data: Any, indent: int = 0) -> str:
    """Serialize a Python structure into simple YAML without external deps."""

    if isinstance(data, dict):
        lines = _render_dict(data, indent)
    elif isinstance(data, list):
        lines = _render_list(data, indent)
    else:
        lines = [" " * indent + str(data)]
    return "\n".join(lines)


__all__ = [
    "AUTO_SECTION_PATTERN",
    "ROOT",
    "extract_auto_block",
    "render_yaml_block",
    "replace_auto_block",
]
