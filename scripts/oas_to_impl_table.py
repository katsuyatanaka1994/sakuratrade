#!/usr/bin/env python3
"""Generate a Markdown table of main OpenAPI endpoints."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple

import yaml


DEFAULT_OPENAPI_PATH = Path("backend/app/openapi.yaml")
SUMMARY_MAX_LENGTH = 60
SUMMARY_TRIM_CHARS = " .,:;!?、。！？"
ELLIPSIS = "…"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Render OpenAPI implementation details as Markdown")
    parser.add_argument(
        "openapi_path",
        nargs="?",
        default=str(DEFAULT_OPENAPI_PATH),
        help="Path to the OpenAPI YAML file (default: backend/app/openapi.yaml)",
    )
    return parser.parse_args()


def ensure_length(text: str) -> str:
    cleaned = " ".join(text.strip().split()) if text else ""
    if not cleaned:
        cleaned = "unspecified"
    if cleaned.lower() == "none":
        return "none"
    if len(cleaned) > 20:
        return f"{cleaned[:17]}..."
    while len(cleaned) < 10:
        cleaned += "-"
    return cleaned


def _base_name_from_ref(ref: str) -> str:
    return ref.split("/")[-1]


def _summarize_schema(schema: Dict[str, Any] | None) -> str:
    if not schema:
        return "none"
    if "$ref" in schema:
        return f"object:{_base_name_from_ref(schema['$ref'])}"

    schema_type = schema.get("type")
    if isinstance(schema_type, list):
        schema_type = "/".join(str(part) for part in schema_type)

    if schema_type == "array":
        inner = _summarize_schema(schema.get("items"))
        inner_name = inner.split(":", 1)[-1] if ":" in inner else inner
        return f"array:{inner_name}"
    if schema_type == "object":
        title = schema.get("title")
        if title:
            return f"object:{title}"
        return "object"
    if schema_type:
        return f"type:{schema_type}"
    if "properties" in schema:
        return "object"
    if any(key in schema for key in ("oneOf", "anyOf", "allOf")):
        return "composed"
    return "schema"


def _format_schema_cell(schema: Dict[str, Any] | None) -> str:
    label = _summarize_schema(schema)
    if label == "none":
        return "none"
    return ensure_length(label)


def _format_description(text: str | None) -> str | None:
    if not text:
        return None
    cleaned = " ".join(str(text).split())
    if not cleaned:
        return None
    return ensure_length(cleaned)


def summarize_request(details: Dict[str, Any]) -> str:
    request_body = details.get("requestBody")
    if not request_body:
        return "none"

    content = request_body.get("content") or {}
    for media_type in sorted(content.keys()):
        schema = content[media_type].get("schema")
        if schema:
            return _format_schema_cell(schema)
    return "none"


def summarize_2xx_response(details: Dict[str, Any]) -> str:
    responses = details.get("responses") or {}
    summaries: List[Tuple[str, str]] = []
    for status, response in sorted(responses.items(), key=_status_sort_key):
        if not str(status).startswith("2"):
            continue
        label = None
        if isinstance(response, dict):
            content = response.get("content") or {}
            for media_type in sorted(content.keys()):
                schema = content[media_type].get("schema")
                if schema:
                    label = _format_schema_cell(schema)
                    break
            if not label:
                label = _format_description(response.get("description"))
        summaries.append((str(status), label or "none"))

    if not summaries:
        return "none"

    statuses = ",".join(status for status, _ in summaries)
    labels = {label for _, label in summaries}
    if len(summaries) == 1:
        status, label = summaries[0]
        if label == "none":
            return "none"
        return ensure_length(label if statuses == label else label)

    if len(labels) == 1:
        label = labels.pop()
        if label == "none":
            return ensure_length(f"{statuses} none")
        return ensure_length(f"{statuses} {label}")

    status, label = summaries[0]
    if label == "none":
        return ensure_length(f"{statuses} none")
    return ensure_length(f"{status} {label}")


def format_summary(details: Dict[str, Any]) -> str:
    raw = details.get("summary") or details.get("operationId") or "No summary"
    cleaned = " ".join(str(raw).split())
    cleaned = cleaned.rstrip(SUMMARY_TRIM_CHARS)
    if not cleaned:
        cleaned = "No summary"
    if len(cleaned) > SUMMARY_MAX_LENGTH:
        trimmed = cleaned[: SUMMARY_MAX_LENGTH - 1].rstrip()
        cleaned = f"{trimmed}{ELLIPSIS}"
    return cleaned


def _status_sort_key(item: Tuple[str, Any]) -> Tuple[int, str]:
    status, _ = item
    try:
        status_int = int(status)
    except (TypeError, ValueError):
        status_int = 999
    return status_int, status


def iter_operations(paths: Dict[str, Any]) -> Iterable[Tuple[str, str, Dict[str, Any]]]:
    for path, methods in paths.items():
        if not isinstance(methods, dict):
            continue
        for method, details in methods.items():
            if not isinstance(details, dict):
                continue
            yield method.upper(), path, details


def render_table(rows: Iterable[Tuple[str, str, Dict[str, Any]]]) -> str:
    sorted_rows = sorted(rows, key=lambda item: (item[1], item[0]))
    lines = [
        "# AUTO-GENERATED FILE. DO NOT EDIT.",
        "| Method | Path | Summary | Request Body | 2xx Response |",
        "|--------|------|---------|--------------|--------------|",
    ]
    for method, path, details in sorted_rows:
        summary = format_summary(details)
        request_summary = summarize_request(details)
        response_summary = summarize_2xx_response(details)
        lines.append(f"| {method} | {path} | {summary} | {request_summary} | {response_summary} |")
    return "\n".join(lines)


def main() -> int:
    args = parse_args()
    openapi_path = Path(args.openapi_path)
    try:
        with open(openapi_path, "r", encoding="utf-8") as fh:
            spec = yaml.safe_load(fh) or {}
    except FileNotFoundError:
        sys.stderr.write(f"OpenAPI file not found: {openapi_path}\n")
        return 1

    paths = spec.get("paths") or {}
    table = render_table(iter_operations(paths))
    sys.stdout.write(f"{table}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
