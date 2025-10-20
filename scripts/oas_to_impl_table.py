#!/usr/bin/env python3
"""Generate a Markdown table of main OpenAPI endpoints."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, Tuple

import yaml


DEFAULT_OPENAPI_PATH = Path("backend/app/openapi.yaml")


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
    if len(cleaned) > 20:
        return f"{cleaned[:17]}..."
    while len(cleaned) < 10:
        cleaned += "-"
    return cleaned


def describe_schema(schema: Dict[str, Any] | None) -> str:
    if not schema:
        return "no payload"
    if "$ref" in schema:
        return f"ref:{schema['$ref'].split('/')[-1]}"

    schema_type = schema.get("type")
    if isinstance(schema_type, list):  # union type
        schema_type = "/".join(str(part) for part in schema_type)

    if schema_type == "array":
        inner = describe_schema(schema.get("items"))
        inner_desc = inner.split(":", 1)[-1]
        return f"array:{inner_desc}"
    if schema_type:
        return f"type:{schema_type}"
    if "properties" in schema:
        return "object props"
    if "oneOf" in schema or "anyOf" in schema or "allOf" in schema:
        return "composed schema"
    return "schema data"


def summarize_request(details: Dict[str, Any]) -> str:
    request_body = details.get("requestBody")
    if not request_body:
        return ensure_length("no payload")

    content = request_body.get("content") or {}
    for media_type in sorted(content.keys()):
        schema = content[media_type].get("schema")
        return ensure_length(describe_schema(schema))
    return ensure_length("no payload")


def summarize_2xx_response(details: Dict[str, Any]) -> str:
    responses = details.get("responses") or {}
    for status, response in sorted(responses.items(), key=_status_sort_key):
        if not str(status).startswith("2"):
            continue
        if isinstance(response, dict):
            content = response.get("content") or {}
            for media_type in sorted(content.keys()):
                schema = content[media_type].get("schema")
                return ensure_length(describe_schema(schema))
            description = response.get("description")
            if description:
                return ensure_length(description)
        return ensure_length("no payload")
    return ensure_length("no payload")


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
    lines = ["# AUTO-GENERATED FILE. DO NOT EDIT.", "", "| Method | Path | Summary | Request Body | 2xx Response |", "| --- | --- | --- | --- | --- |"]
    for method, path, details in rows:
        summary = details.get("summary") or details.get("operationId") or "No summary"
        summary = " ".join(str(summary).split())
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
