#!/usr/bin/env python3
import datetime
import os
import re
import sys
from pathlib import Path

FILE = Path("docs/agile/ui-specification.md")
START_RE = re.compile(r"<!--\s*ASSIST-START(?:\s*:\s*ui-spec)?\s*-->")
END_RE = re.compile(r"<!--\s*ASSIST-END(?:\s*:\s*ui-spec)?\s*-->")


def ensure_file_and_markers():
    if not FILE.exists():
        FILE.parent.mkdir(parents=True, exist_ok=True)
        FILE.write_text("# UI仕様（ハブ）\n\n", encoding="utf-8")
    text = FILE.read_text(encoding="utf-8")
    if not (START_RE.search(text) and END_RE.search(text)):
        text += "\n<!-- ASSIST-START:ui-spec -->\n<!-- ASSIST-END:ui-spec -->\n"
        FILE.write_text(text, encoding="utf-8")
    return FILE.read_text(encoding="utf-8")


def replace_block(text, body):
    start = START_RE.search(text)
    end = END_RE.search(text)
    if not (start and end) or start.end() > end.start():
        print("::error title=ASSIST markers invalid::ui-spec markers are missing or mis-ordered.")
        sys.exit(1)
    return text[: start.end()] + "\n" + body.strip() + "\n" + text[end.start() :]


def main():
    screen = os.environ.get("INPUT_SCREEN", "(screen)")  # workflow_dispatch inputs
    summary = os.environ.get("INPUT_SUMMARY", "")
    notes = os.environ.get("INPUT_NOTES", "")
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")

    lines = [
        f"### {screen}",
        f"- 更新: {now}",
        f"- 概要: {summary or '（追記してください）'}",
        "",
        "#### 主要操作",
        "- （例）エントリー登録／編集／削除",
        "",
        "#### 状態・バリデーション",
        "- （例）必須: 価格・枚数・サイド",
        "",
        "#### UIイベント → API",
        "- （例）POST /trades, GET /trades/{trade_id}",
    ]

    notes_block = []
    if notes:
        notes_block = ["", "#### 備考", notes]

    content = "\n".join(lines + notes_block).rstrip()

    text = ensure_file_and_markers()
    new_text = replace_block(text, content)
    FILE.write_text(new_text, encoding="utf-8")
    print("ui-spec manual: OK")


if __name__ == "__main__":
    main()
