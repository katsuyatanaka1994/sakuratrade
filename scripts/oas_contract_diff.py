#!/usr/bin/env python3
import json
import os
import subprocess
import sys
from typing import Any, Dict, List, Tuple

import yaml


FILE = "backend/app/openapi.yaml"
BASE_SHA = os.environ.get("BASE_SHA", "").strip()
STRICT = os.environ.get("STRICT", "false").lower() in ("1", "true", "yes")


def sh(cmd: List[str]) -> str:
    return subprocess.check_output(cmd, text=True).strip()


def load_yaml_text(text: str) -> Dict[str, Any]:
    doc = yaml.safe_load(text) or {}
    return doc


def load_head() -> Dict[str, Any]:
    with open(FILE, "r", encoding="utf-8") as f:
        return load_yaml_text(f.read())


def load_base() -> Dict[str, Any]:
    if not BASE_SHA:
        base = sh(["git", "merge-base", "origin/main", "HEAD"])
    else:
        base = BASE_SHA
    try:
        text = sh(["git", "show", f"{base}:{FILE}"])
    except subprocess.CalledProcessError:
        return {}
    return load_yaml_text(text)


def arr(v: Any) -> List[Any]:
    return v if isinstance(v, list) else [v]


def get_paths_ops(doc: Dict[str, Any]) -> Dict[str, List[str]]:
    out: Dict[str, List[str]] = {}
    for p, node in (doc.get("paths") or {}).items():
        if not isinstance(node, dict):
            continue
        ops = [
            m
            for m in node.keys()
            if m.lower()
            in ("get", "post", "put", "patch", "delete", "head", "options", "trace")
        ]
        out[p] = sorted(ops)
    return out


def get_responses(doc: Dict[str, Any], path: str, op: str) -> Dict[str, Any]:
    try:
        return (doc.get("paths", {}).get(path, {}).get(op, {}).get("responses", {})) or {}
    except Exception:
        return {}


def get_req_required(doc: Dict[str, Any], path: str, op: str) -> bool:
    rb = doc.get("paths", {}).get(path, {}).get(op, {}).get("requestBody")
    if isinstance(rb, dict):
        return bool(rb.get("required", False))
    return False


def first_schema_type(schema: Any):
    if not isinstance(schema, dict):
        return None
    t = schema.get("type")
    if isinstance(t, list):
        return tuple(sorted(t))
    return t


def response_content_schema(resp: Dict[str, Any]) -> Any:
    content = resp.get("content") or {}
    for ctype in ("application/json", "application/*+json", "*/*"):
        if ctype in content:
            return (content[ctype].get("schema") or {})
    return resp.get("schema") or {}


def resp_headers(resp: Any) -> Dict[str, Any]:
    if isinstance(resp, dict):
        return resp.get("headers") or {}
    return {}


def detect_breaking(
    base: Dict[str, Any], head: Dict[str, Any]
) -> Tuple[List[str], List[str], List[str], List[str], List[str]]:
    out_removed_paths: List[str] = []
    out_removed_ops: List[str] = []
    out_removed_resp: List[str] = []
    out_removed_hdr: List[str] = []
    out_strict: List[str] = []

    bpo = get_paths_ops(base)
    hpo = get_paths_ops(head)

    for p in bpo.keys():
        if p not in hpo:
            out_removed_paths.append(p)

    for p, bops in bpo.items():
        hops = hpo.get(p, [])
        for op in bops:
            if op not in hops:
                out_removed_ops.append(f"{op.upper()} {p}")

    for p, bops in bpo.items():
        for op in bops:
            bres = get_responses(base, p, op)
            hres = get_responses(head, p, op)
            for code in bres.keys():
                if code not in hres:
                    out_removed_resp.append(f"{op.upper()} {p} :: {code}")
            for code, bnode in bres.items():
                hnode = hres.get(code)
                if not hnode:
                    continue
                bh = resp_headers(bnode)
                hh = resp_headers(hnode or {})
                for hname in bh.keys():
                    if hname not in hh:
                        out_removed_hdr.append(
                            f"{op.upper()} {p} :: {code} header '{hname}'"
                        )
                bt = first_schema_type(response_content_schema(bnode))
                ht = first_schema_type(response_content_schema(hnode))
                if bt is None or ht is None:
                    continue
                if bt != ht:
                    out_strict.append(f"{op.upper()} {p} :: {code} type {bt} -> {ht}")

    return out_removed_paths, out_removed_ops, out_removed_resp, out_removed_hdr, out_strict


def detect_reqbody_harder(base: Dict[str, Any], head: Dict[str, Any]) -> List[str]:
    hits: List[str] = []
    bpo = get_paths_ops(base)
    hpo = get_paths_ops(head)
    for p, hops in hpo.items():
        for op in hops:
            if get_req_required(head, p, op):
                if not get_req_required(base, p, op):
                    hits.append(f"{op.upper()} {p} :: requestBody required=True")
    return hits


def main() -> None:
    base = load_base()
    head = load_head()

    rp, ro, rr, rh, rt = detect_breaking(base, head)
    rq = detect_reqbody_harder(base, head)

    breaking = len(rp) + len(ro) + len(rr) + len(rq) + len(rh)
    header = "### 🔎 OpenAPI Contract Diff\n\n"
    md: List[str] = [header]
    md.append(
        f"- Base: `{BASE_SHA or 'merge-base(origin/main, HEAD)'}`\n- Head: `{sh(['git', 'rev-parse', '--short', 'HEAD'])}`\n"
    )

    if breaking == 0 and len(rt) == 0:
        md.append("\n✅ **No breaking changes detected.**\n")
    else:
        md.append("\n⚠️ **Potential breaking changes**\n")
        if rp:
            md.append("- Removed paths:\n")
            md.extend([f"  - `{p}`" for p in rp])
        if ro:
            md.append("- Removed operations:\n")
            md.extend([f"  - `{s}`" for s in ro])
        if rr:
            md.append("- Removed responses:\n")
            md.extend([f"  - `{s}`" for s in rr])
        if rq:
            md.append("- Request stricter (required):\n")
            md.extend([f"  - `{s}`" for s in rq])
    if rh:
        md.append("\n🧩 **Removed response headers**\n")
        md.extend([f"- `{s}`" for s in rh])
    if rt:
        md.append("\n📝 **Type changes (top-level response schema)**\n")
        md.extend([f"- `{s}`" for s in rt])

    print("\n".join(md))

    if STRICT and breaking > 0:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
