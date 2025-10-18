#!/usr/bin/env python3
import sys, json, glob, traceback
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[1]
MAP = ROOT / "docs/agile/mapping.yml"

def deep_merge(dst, src):
    if isinstance(dst, dict) and isinstance(src, dict):
        out = dict(dst)
        for k, v in src.items():
            out[k] = deep_merge(out.get(k), v)
        return out
    return src if src is not None else dst

def load_mapping():
    try:
        cfg = yaml.safe_load(MAP.read_text(encoding="utf-8")) or {}
    except Exception as e:
        print(f"::error ::Failed to load {MAP}: {e}")
        traceback.print_exc()
        sys.exit(2)
    mappings = cfg.get("mappings", [])
    for item in mappings:
        if str(item.get("id", "")).lower() == "openapi":
            return item
    print("::error ::mapping id 'openapi' not found in docs/agile/mapping.yml")
    sys.exit(2)

def resolve_source(src):
    candidates = []
    if isinstance(src, str):
        candidates = glob.glob(str(ROOT / src)) or [str(ROOT / src)]
    else:
        for s in src:
            candidates += glob.glob(str(ROOT / s)) or [str(ROOT / s)]
    for c in candidates:
        p = Path(c)
        if p.exists():
            return p
    print(f"::error ::source file not found: {candidates}")
    sys.exit(2)

def read_obj(path: Path):
    txt = path.read_text(encoding="utf-8")
    if path.suffix.lower() == ".json":
        return json.loads(txt)
    return yaml.safe_load(txt)

def load_yaml_safe(path: Path):
    try:
        return yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except Exception:
        return {}

def main():
    m = load_mapping()
    src_path = resolve_source(m["source"])
    tgt_path = ROOT / m["target"]
    tgt_path.parent.mkdir(parents=True, exist_ok=True)

    # 1) parse & normalize
    try:
        obj = read_obj(src_path) or {}
    except Exception as e:
        print(f"::error ::Failed to parse {src_path}: {e}")
        traceback.print_exc()
        sys.exit(2)

    # 2) optional shrink guard
    allow_shrink = bool(m.get("allow_shrink", False))
    min_paths = int(m.get("min_paths", 0))
    tgt_obj = load_yaml_safe(tgt_path) if tgt_path.exists() else {}
    tgt_paths = len((tgt_obj.get("paths") or {}))
    src_paths = len((obj.get("paths") or {}))
    threshold = max(min_paths, int(tgt_paths * 0.5))
    if not allow_shrink and tgt_paths and src_paths < threshold:
        print(f"Skip: source paths({src_paths}) < threshold({threshold}) with target paths({tgt_paths}).")
        sys.exit(0)

    # 3) header + normalized dump
    if m.get("mode") == "overlay":
        if isinstance(tgt_obj, dict) and isinstance(obj, dict):
            merged = deep_merge(tgt_obj, obj)
        else:
            # Fallback to replace when overlay inputs are not both mappings
            merged = obj
    else:
        merged = obj

    header = "\n".join([
        "# AUTO-GENERATED FILE",
        "# このファイルは自動生成されます。直接編集しないでください。",
    ]) + "\n"
    body = yaml.safe_dump(
        merged,
        sort_keys=False,
        allow_unicode=True,
        default_flow_style=False,
        width=120,
    )
    out = header + body

    # 4) atomic write
    tmp = tgt_path.with_suffix(tgt_path.suffix + ".tmp")
    tmp.write_text(out, encoding="utf-8", newline="\n")
    tmp.replace(tgt_path)

    print(f"SRC: {src_path}")
    print(f"WROTE: {tgt_path}")

if __name__ == "__main__":
    main()
