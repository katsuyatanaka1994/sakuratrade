#!/usr/bin/env python3
import os, re, sys, subprocess, pathlib

FILE = "docs/agile/README-agile.md"

# ラベル付きも許可（例: <!-- ASSIST-START:status -->）
START_RE = re.compile(r'<!--\s*ASSIST-START(?:\s*:\s*[\w.\-]+)?\s*-->')
END_RE   = re.compile(r'<!--\s*ASSIST-END(?:\s*:\s*[\w.\-]+)?\s*-->')
START_DESC = "ASSIST-START(:label)"
END_DESC   = "ASSIST-END(:label)"

INDEX_LABEL = "index"
INDEX_MAX_DISTANCE = 100

def run(cmd: list[str]) -> str:
    return subprocess.check_output(cmd, text=True).strip()

def is_assist_line(label, line):
    start = f"<!-- ASSIST-START:{label} -->"
    end = f"<!-- ASSIST-END:{label} -->"
    return line.strip() in {start, end}


def allowed_ranges(lines):
    """ASSISTの“内側の本文のみ”を許可（マーカー行は除外）。"""
    starts, ends = [], []
    for i, line in enumerate(lines, 1):
        if START_RE.search(line):
            starts.append(i)
        if END_RE.search(line):
            ends.append(i)
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


def ranges_without_markers(pairs):
    return [(s + 1, e - 1) for s, e in pairs]


def enforce_index_constraints(lines, pairs):
    headings = [i for i, line in enumerate(lines, 1) if re.match(r"^##\s*.*(索引|Index)\b", line)]
    index_pairs = [(s, e) for (s, e) in pairs if lines[s - 1].strip().startswith("<!-- ASSIST-START:index")]
    if not index_pairs:
        return  # nothing to validate
    if len(index_pairs) != 1:
        print(f"::error title=Invalid index block::{FILE} の {INDEX_LABEL} ブロックが複数あります。"); sys.exit(1)
    s, e = index_pairs[0]
    if not headings:
        print(f"::error title=Missing index heading::{FILE} に索引/Index 見出しが見つかりません。")
        sys.exit(1)
    nearest = min(headings, key=lambda h: abs(h - s))
    if s < nearest:
        print(f"::error title=Index marker position::{INDEX_LABEL} ブロックが索引見出しより上にあります。")
        sys.exit(1)
    if (s - nearest) > INDEX_MAX_DISTANCE:
        print(f"::error title=Index marker distance::{INDEX_LABEL} ブロックが索引見出しから離れすぎています (>{INDEX_MAX_DISTANCE} 行)。")
        sys.exit(1)


def marker_line_in_diff(line, allowed_labels):
    stripped = line.strip()
    for label in allowed_labels:
        if stripped in {f"<!-- ASSIST-START:{label} -->", f"<!-- ASSIST-END:{label} -->"}:
            return True
    return False

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

    if not pathlib.Path(FILE).exists():
        print(f"::notice::{FILE} が存在しません。ガードをスキップします。")
        return

    # HEAD側（新）とBASE側（旧）を読み込む
    head_text = pathlib.Path(FILE).read_text(encoding="utf-8")
    head_lines = head_text.splitlines()
    base_text = run(["git","show", f"{base_sha}:{FILE}"])
    base_lines = base_text.splitlines()

    pairs_head = allowed_ranges(head_lines)
    pairs_base = allowed_ranges(base_lines)
    enforce_index_constraints(head_lines, pairs_head)
    enforce_index_constraints(base_lines, pairs_base)

    ranges_head = ranges_without_markers(pairs_head)
    ranges_base = ranges_without_markers(pairs_base)

    existing_labels_base = {base_lines[s - 1].strip() for s, _ in pairs_base}
    allowed_marker_additions = {INDEX_LABEL}

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
            content = line[1:]
            if marker_line_in_diff(content, allowed_marker_additions):
                new_ln += 1
                continue
            if content.strip() == '' and marker_line_in_diff(diff.splitlines()[diff.splitlines().index(line) - 1][1:], allowed_marker_additions):
                new_ln += 1
                continue
            if not in_ranges(new_ln, ranges_head):
                bad_changes.append(("add", new_ln))
            new_ln += 1
        elif line.startswith('-') and not line.startswith('---'):
            content = line[1:]
            if marker_line_in_diff(content, allowed_marker_additions):
                old_ln += 1
                continue
            if content.strip() == '' and marker_line_in_diff(diff.splitlines()[diff.splitlines().index(line) - 1][1:], allowed_marker_additions):
                old_ln += 1
                continue
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
