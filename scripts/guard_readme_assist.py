#!/usr/bin/env python3
import os, re, sys, subprocess, pathlib

FILE = "docs/agile/README-agile.md"
START = "<!-- ASSIST-START -->"
END   = "<!-- ASSIST-END -->"

def run(cmd: list[str]) -> str:
    return subprocess.check_output(cmd, text=True).strip()

def allowed_ranges(lines):
    starts, ends = [], []
    for i, line in enumerate(lines, 1):
        if START in line: starts.append(i)
        if END in line:   ends.append(i)
    if len(starts) != len(ends):
        print(f"::error title=ASSIST block mismatch::{FILE} の {START}/{END} 数が不一致です。")
        sys.exit(1)
    pairs = []
    for s, e in zip(starts, ends):
        if s >= e:
            print(f"::error title=ASSIST block order::{FILE} のASSISTブロック順序が不正です。")
            sys.exit(1)
        pairs.append((s, e))
    return pairs

def in_ranges(n, ranges):
    return any(s <= n <= e for s, e in ranges)

def main():
    base_sha = os.environ.get("BASE_SHA")
    if not base_sha:
        # PR以外でも動くようフォールバック
        base_sha = run(["git","merge-base","origin/main","HEAD"])

    if not pathlib.Path(FILE).exists():
        print(f"::notice::{FILE} が存在しません。ガードをスキップします。")
        return

    head_lines = pathlib.Path(FILE).read_text(encoding="utf-8").splitlines()
    ranges = allowed_ranges(head_lines)

    diff = run(["git","diff","--unified=0","--no-color",f"{base_sha}...HEAD","--",FILE])
    # hunk: @@ -a,b +c,d @@
    hunk_re = re.compile(r"^\@\@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? \@\@")
    bad_changes = []

    cur_add_start, cur_add_len = None, None
    for line in diff.splitlines():
        m = hunk_re.match(line)
        if m:
            cur_add_start = int(m.group(1))
            cur_add_len = int(m.group(2) or "1")
            # 変更された「HEAD側の行」をチェック
            for n in range(cur_add_start, cur_add_start + cur_add_len):
                if not in_ranges(n, ranges):
                    bad_changes.append(n)

    if bad_changes:
        msg = (
            f"{FILE} のASSISTブロック外を変更しています（例: 行 {bad_changes[:10]} …）。\n"
            f"{START}〜{END} の内部のみ編集可です。"
        )
        print(f"::error title=Forbid non-ASSIST edits::{msg}")
        sys.exit(1)
    else:
        print("ASSIST guard: OK")

if __name__ == "__main__":
    main()