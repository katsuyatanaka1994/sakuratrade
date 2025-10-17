#!/usr/bin/env python3
import os, re, sys, subprocess, pathlib

FILE = "docs/agile/README-agile.md"
START_RE = re.compile(r'<!--\s*ASSIST-START(?:\s*:\s*[\w.\-]+)?\s*-->')
END_RE   = re.compile(r'<!--\s*ASSIST-END(?:\s*:\s*[\w.\-]+)?\s*-->')
START_DESC = "ASSIST-START(:label)"
END_DESC   = "ASSIST-END(:label)"

def run(cmd: list[str]) -> str:
    return subprocess.check_output(cmd, text=True).strip()

def allowed_ranges(lines):
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
    new_line_no = None  # current line number in the new (HEAD) file for this hunk

    for line in diff.splitlines():
        m = hunk_re.match(line)
        if m:
            # Start of a new hunk; set current new-file line number
            new_line_no = int(m.group(1))
            continue
        if new_line_no is None:
            # Not inside a hunk yet
            continue
        if line.startswith('+') and not line.startswith('+++'):
            # This is an added line in the new file at position new_line_no
            if not in_ranges(new_line_no, ranges):
                bad_changes.append(new_line_no)
            new_line_no += 1
        elif line.startswith('-') and not line.startswith('---'):
            # Deletion from old file; new file line number does not advance
            continue
        elif line.startswith(' ') or line == '':
            # Context line (rare with --unified=0), advance new file line number
            new_line_no += 1
        elif line.startswith('\\'):
            # "\ No newline at end of file" marker — ignore
            continue

    if bad_changes:
        msg = (
            f"{FILE} のASSISTブロック外を変更しています（例: 行 {bad_changes[:10]} …）。\n"
            f"{START_DESC}〜{END_DESC} の内部のみ編集可です。"
        )
        print(f"::error title=Forbid non-ASSIST edits::{msg}")
        sys.exit(1)
    else:
        print("ASSIST guard: OK")

if __name__ == "__main__":
    main()