#!/usr/bin/env python3
import glob
import json
import sys
from pathlib import Path

import yaml  # pip install pyyaml

ROOT = Path(__file__).resolve().parents[1]
MAP = ROOT / "docs/agile/mapping.yml"

cfg = yaml.safe_load(MAP.read_text())
m = next(x for x in cfg["mappings"] if x["id"] in ("openapi", "openapi"))
src = m["source"]
tgt = ROOT / m["target"]
tgt.parent.mkdir(parents=True, exist_ok=True)

def load_as_yaml_text(p: Path) -> str:
    p = Path(p)
    if p.suffix == ".json":
        data = json.loads(p.read_text())
        return yaml.safe_dump(data, sort_keys=False, allow_unicode=True)
    return p.read_text()


# 単一/配列/グロブのどれでも可（最初に見つかったものを採用）
candidates = []
if isinstance(src, str):
    candidates = glob.glob(str(ROOT / src)) or [str(ROOT / src)]
else:
    for s in src:
        candidates += glob.glob(str(ROOT / s)) or [str(ROOT / s)]

src_file = next((Path(c) for c in candidates if Path(c).exists()), None)
if not src_file:
    print("source file not found:", candidates, file=sys.stderr)
    sys.exit(1)

body = load_as_yaml_text(src_file)
header = (
    "# AUTO-GENERATED FILE\n"
    "# このファイルは自動生成されます。直接編集しないでください。\n"
)

tgt.write_text(header + body, encoding="utf-8")
print(f"Wrote {tgt}")
