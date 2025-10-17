#!/usr/bin/env python3
import glob
import json
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
MAP = ROOT / "docs/agile/mapping.yml"

cfg = yaml.safe_load(MAP.read_text())
m = next(x for x in cfg["mappings"] if x["id"] in ("openapi", "OpenAPI", "Openapi"))

src = m["source"]
tgt = ROOT / m["target"]
mode = m.get("mode", "replace")
allow_shrink = bool(m.get("allow_shrink", False))
min_paths = int(m.get("min_paths", 0))

tgt.parent.mkdir(parents=True, exist_ok=True)


def load_yaml_text(p: Path) -> str:
    if p.suffix == ".json":
        data = json.loads(p.read_text())
        return yaml.safe_dump(data, sort_keys=False, allow_unicode=True)
    return p.read_text()


def load_yaml_obj_from_text(txt: str):
    return yaml.safe_load(txt) or {}


# 1) ソースファイルを決定（単一/配列/グロブOK）
cands = []
if isinstance(src, str):
    cands = glob.glob(str(ROOT / src)) or [str(ROOT / src)]
else:
    for s in src:
        cands += glob.glob(str(ROOT / s)) or [str(ROOT / s)]

src_file = next((Path(c) for c in cands if Path(c).exists()), None)
if not src_file:
    print("source file not found:", cands, file=sys.stderr)
    sys.exit(1)

src_text = load_yaml_text(src_file)
src_obj = load_yaml_obj_from_text(src_text)
src_paths = len((src_obj.get("paths") or {}))

# 2) 既存targetのpaths数を把握
tgt_text = tgt.read_text(encoding="utf-8") if tgt.exists() else ""
tgt_obj = load_yaml_obj_from_text(tgt_text)
tgt_paths = len((tgt_obj.get("paths") or {}))

# 3) 痩せ防止ガード
threshold = max(min_paths, int(tgt_paths * 0.5))
if not allow_shrink and tgt_paths and src_paths < threshold:
    print(
        f"Skip: source paths({src_paths}) < threshold({threshold}) with target paths({tgt_paths})."
    )
    sys.exit(0)

# 4) 出力（今は置換のみ）
header = "\n".join(
    [
        "# AUTO-GENERATED FILE",
        "# このファイルは自動生成されます。直接編集しないでください。",
    ]
) + "\n"
out_text = (
    yaml.safe_dump(src_obj, sort_keys=False, allow_unicode=True)
    if src_file.suffix == ".json"
    else src_text
)

tgt.write_text(header + out_text, encoding="utf-8")
print(f"Wrote {tgt}")
