#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import yaml

SOURCE = "backend/app/openapi.yaml"
TARGET = "docs/specs/openapi.yaml"
PLAN = "doc_sync_plan.json"


def load_yaml(path):
    p = Path(path)
    if not p.exists():
        print(f"::error title=Missing file::{path} not found.")
        return None
    with p.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def norm_dump(data):
    # YAML→Python→YAML（キーソート）で正規化
    return yaml.safe_dump(data or {}, sort_keys=True, allow_unicode=True)


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def main():
    src = load_yaml(SOURCE)
    tgt = load_yaml(TARGET)
    if src is None or tgt is None:
        # どちらか読めない時点で失敗
        sys.exit(1)

    src_norm = norm_dump(src)
    tgt_norm = norm_dump(tgt)
    equal = src_norm == tgt_norm

    # 参考情報（OpenAPIっぽいなら paths 数も添える）
    src_paths = len((src or {}).get("paths", {}) or {})
    tgt_paths = len((tgt or {}).get("paths", {}) or {})

    plan = {
        "source": SOURCE,
        "target": TARGET,
        "equal": equal,
        "source_sha256": sha256_text(src_norm),
        "target_sha256": sha256_text(tgt_norm),
        "stats": {"src_paths": src_paths, "tgt_paths": tgt_paths},
        "recommendation": (
            "Run Actions → docsync-apply (on your branch) to regenerate target from source."
            if not equal
            else "No action needed."
        ),
    }
    with open(PLAN, "w", encoding="utf-8") as f:
        json.dump(plan, f, ensure_ascii=False, indent=2)

    if not equal:
        message = (
            "::error title=DocSync drift detected::"
            "backend/app/openapi.yaml と docs/specs/openapi.yaml が不一致です。"
            "Actions → docsync-apply を実行してください。"
        )
        print(message)
        print("DRIFT")
        sys.exit(1)
    else:
        print("EQUAL")
        sys.exit(0)


if __name__ == "__main__":
    main()
