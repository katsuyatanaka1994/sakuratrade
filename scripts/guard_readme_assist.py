#!/usr/bin/env python3
import os, re, sys, subprocess, pathlib

FILE = "docs/agile/README-agile.md"

# ラベル付きも許可（例: ASSIST-START:status）
START_RE = re.compile(r'<!--\s*ASSIST-START(?:\s*:\s*[\w.\-]+)?\s*-->')
END_RE   = re.compile(r'<!--\s*ASSIST-END(?:\s*:\s*[\w.\-]+)?\s*-->')
START_DESC = "ASSIST-START(:label)"
END_DESC   = "ASSIST-END(:label)"

def run(cmd: list[str]) -> str:
    return subprocess.check_output(cmd, text=True).strip()

def allowed_ranges(lines):
    """ASSISTの“内側の本文のみ”を許可（マーカー行は除外）。"""
    starts, ends = [], []
    for i, line in enumerate(lines, 1):
        if START_RE.search(line): starts.append(i)
        if END_RE.search(line):   ends.append(i)
    if len(starts) != len(ends):
        print(f"::error title=ASSIST block mismatch::{FILE} の {START_DESC}/{END_DESC} 数が不一致です。")
        sys.exit(1)
    pairs = []
    for s, e in zip(starts, ends):
        if s >= e:
            print(f"::error title=ASSIST block order::{FILE} のASSISTブロック順序が不正です。")
            sys.exit(1)
        # マーカー行は編集不可 → s+1 〜 e-1 のみ許可
        pairs.append((s + 1, e - 1))
    return pairs

def in_ranges(n, ranges):
    return any(s <= n <= e for (s, e) in ranges)

def main():
    base_sha = os.environ.get("BASE_SHA")
    if not base_sha:
        # PR以外でも動くようフォールバック
        base_sha = run(["git","merge-base","origin/main","HEAD"])

    if not pathlib.Path(FILE).exists():
        print(f"::notice::{FILE} が存在しません。ガードをスキップします。")
        return

    # HEAD側（新ファイル）とBASE側（旧ファイル）を取得
    head_text = pathlib.Path(FILE).read_text(encoding="utf-8")
    head_lines = head_text.splitlines()
    base_text = run(["git","show", f"{base_sha}:{FILE}"])
    base_lines = base_text.splitlines()

    ranges_head = allowed_ranges(head_lines)
    ranges_base = allowed_ranges(base_lines)

    diff = run(["git","diff","--unified=0","--no-color", f"{base_sha}...HEAD","--",FILE])

    # @@ -oldStart,oldLen +newStart,newLen @@
    hunk_re = re.compile(r"^\@\@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? \@\@")
    bad_changes = []
    old_ln = new_ln = None

    for line in diff.splitlines():
        m = hunk_re.match(line)
        if m:
            old_ln = int(m.group(1))
            new_ln = int(m.group(3))
            continue
        if old_ln is None or new_ln is None:
            continue

        if line.startswith('+') and not line.startswith('+++'):
            # 追加 → HEAD側の許可範囲で判定
            if not in_ranges(new_ln, ranges_head):
                bad_changes.append(("add", new_ln))
            new_ln += 1
        elif line.startswith('-') and not line.startswith('---'):
            # 削除 → BASE側の許可範囲で判定（旧ファイルの行番号）
            if not in_ranges(old_ln, ranges_base):
                bad_changes.append(("del", old_ln))
            old_ln += 1
        elif line.startswith(' ') or line == '':
            # 文脈行（--unified=0では稀）
            old_ln += 1; new_ln += 1
        elif line.startswith('\\'):
            # "\ No newline at end of file" 等は無視
            continue

    if bad_changes:
        examples = ", ".join([f"{k}@{n}" for k, n in bad_changes[:10]])
        msg = (
            f"{FILE} のASSISTブロック外に対する変更を検出しました（例: {examples} …）。\n"
            f"{START_DESC}〜{END_DESC} の**内側のみ**編集可です（マーカー行自体の編集は不可）。"
        )
        print(f"::error title=Forbid non-ASSIST edits::{msg}")
        sys.exit(1)

    print("ASSIST guard: OK")

if __name__ == "__main__":
    main()