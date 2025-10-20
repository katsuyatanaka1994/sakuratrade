#!/usr/bin/env python3
"""Validate docs index and Markdown links for DS-14."""
from __future__ import annotations

import json
import re
import shlex
import sys
import unicodedata
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, Iterator, List, Optional, Sequence, Set, Tuple
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parent.parent
DOCS_ROOT = ROOT / "docs"
README_INDEX_PATH = DOCS_ROOT / "agile" / "README-agile.md"
REPORT_PATH = ROOT / "docs_index_report.json"

HEADING_RE = re.compile(r"^\s{0,3}(#{1,6})\s+(.+?)\s*(?:#+\s*)?$")


@dataclass
class Issue:
    kind: str
    file: str
    link: str
    note: str
    line: int = 1


def gfm_slug(text: str) -> str:
    """Create a slug similar to GitHub's automatic heading IDs."""
    text = text.strip()
    if not text:
        return ""
    # Replace full-width spaces before lowering
    text = text.replace("\u3000", " ")
    # Remove common Markdown decorations
    text = re.sub(r"`([^`]*)`", r"\1", text)
    text = re.sub(r"\[(.*?)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"[*_~]", "", text)
    text = re.sub(r"\\", "", text)
    text = re.sub(r"\s+", " ", text)
    text = text.lower()

    cleaned_chars: List[str] = []
    for ch in text:
        if ch in {" ", "-"}:
            cleaned_chars.append(" ")
            continue
        category = unicodedata.category(ch)
        if category.startswith(("L", "N")) or category in {"Mn", "Mc"}:
            cleaned_chars.append(ch)
    slug = "".join(cleaned_chars)
    slug = slug.strip()
    slug = re.sub(r"\s+", "-", slug)
    slug = re.sub(r"-{2,}", "-", slug)
    slug = slug.strip("-")
    return slug


def extract_anchors(md_path: Path) -> Set[str]:
    anchors: Set[str] = set()
    slug_counts: Dict[str, int] = defaultdict(int)
    try:
        text = md_path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return anchors

    for line in text.splitlines():
        match = HEADING_RE.match(line)
        if not match:
            continue
        raw = match.group(2).strip()
        slug = gfm_slug(raw)
        if not slug:
            continue
        suffix = slug_counts[slug]
        anchors.add(f"{slug}-{suffix}" if suffix else slug)
        slug_counts[slug] += 1
    return anchors


def is_external_destination(dest: str) -> bool:
    if dest.startswith(("http://", "https://", "mailto:", "//")):
        return True
    # Treat generic schemes as external
    if re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", dest):
        return True
    return False


def split_destination(dest: str) -> str:
    dest = dest.strip()
    if not dest:
        return dest
    if dest.startswith("<") and dest.endswith(">"):
        return dest[1:-1]
    try:
        parts = shlex.split(dest)
    except ValueError:
        return dest
    if not parts:
        return dest
    return parts[0]


def iter_links(line: str) -> Iterator[Tuple[bool, str, str]]:
    idx = 0
    length = len(line)
    while idx < length:
        start = line.find('[', idx)
        if start == -1:
            break
        if start > 0 and line[start - 1] == '\\':
            idx = start + 1
            continue
        end = line.find(']', start)
        if end == -1:
            break
        if end + 1 >= length or line[end + 1] != '(':
            idx = end + 1
            continue
        dest_start = end + 2
        depth = 1
        pos = dest_start
        while pos < length and depth > 0:
            ch = line[pos]
            if ch == '(':
                depth += 1
            elif ch == ')':
                depth -= 1
            pos += 1
        if depth != 0:
            break
        dest = line[dest_start:pos - 1]
        text = line[start + 1:end]
        is_image = start > 0 and line[start - 1] == '!'
        yield is_image, text, dest
        idx = pos


def resolve_target(base: Path, href: str) -> Optional[Path]:
    href = href.strip()
    if not href:
        return base

    if href.startswith('/'):
        candidate = (ROOT / href.lstrip('/')).resolve()
    else:
        href_path = Path(href)
        if href_path.parts and href_path.parts[0] == 'docs':
            candidate = (ROOT / href_path).resolve()
        else:
            candidate = (base.parent / href_path).resolve()
    try:
        candidate.relative_to(ROOT)
    except ValueError:
        return None
    return candidate


def check_links(md_paths: Sequence[Path], anchors_by_path: Dict[Path, Set[str]]) -> List[Issue]:
    issues: List[Issue] = []
    for md_path in md_paths:
        try:
            lines = md_path.read_text(encoding="utf-8").splitlines()
        except FileNotFoundError:
            continue
        for lineno, line in enumerate(lines, start=1):
            for is_image, _text, raw_dest in iter_links(line):
                if is_image:
                    continue
                href = split_destination(raw_dest)
                href = unquote(href)
                if not href or href.startswith('#'):
                    dest_path = md_path
                    anchor = href[1:] if href.startswith('#') else None
                else:
                    if is_external_destination(href):
                        continue
                    if '?' in href:
                        href, _query = href.split('?', 1)
                    anchor = None
                    if '#' in href:
                        href, anchor = href.split('#', 1)
                    dest_path = resolve_target(md_path, href)
                    if dest_path is None:
                        issues.append(Issue(
                            kind="broken_link",
                            file=str(md_path.relative_to(ROOT)),
                            link=href,
                            note=f"link resolves outside repository: {href}",
                            line=lineno,
                        ))
                        continue
                if dest_path is not None and dest_path.suffix.lower() == '.md':
                    if not dest_path.exists():
                        issues.append(Issue(
                            kind="broken_link",
                            file=str(md_path.relative_to(ROOT)),
                            link=href or dest_path.name,
                            note=f"referenced file not found: {dest_path.relative_to(ROOT)}",
                            line=lineno,
                        ))
                        continue
                    if anchor:
                        anchor_key = gfm_slug(unquote(anchor))
                        known_anchors = anchors_by_path.get(dest_path, set())
                        if anchor_key not in known_anchors:
                            issues.append(Issue(
                                kind="missing_anchor",
                                file=str(md_path.relative_to(ROOT)),
                                link=f"{dest_path.relative_to(ROOT)}#{anchor}",
                                note=f"anchor '#{anchor}' not found in {dest_path.relative_to(ROOT)}",
                                line=lineno,
                            ))
                elif dest_path is not None and anchor:
                    # Non-Markdown target with anchor; nothing to validate
                    continue
    return issues


def collect_index_entries() -> Tuple[Set[Path], List[Issue]]:
    issues: List[Issue] = []
    entries: Set[Path] = set()
    if not README_INDEX_PATH.exists():
        return entries, issues
    try:
        lines = README_INDEX_PATH.read_text(encoding="utf-8").splitlines()
    except FileNotFoundError:
        return entries, issues

    section_start: Optional[int] = None
    section_level: Optional[int] = None

    for idx, line in enumerate(lines):
        match = HEADING_RE.match(line)
        if not match:
            continue
        heading_text = match.group(2)
        heading_lower = heading_text.lower()
        if section_start is None and ("索引" in heading_text or "index" in heading_lower):
            section_start = idx + 1
            section_level = len(match.group(1))
            continue
        if section_start is not None and section_level is not None and len(match.group(1)) <= section_level:
            section_end = idx
            break
    else:
        section_end = len(lines)

    if section_start is None:
        return entries, issues

    section_lines = lines[section_start:section_end]
    code_md_pattern = re.compile(r"`([^`]+\.md(?:#[^`]+)?)`")

    for lineno, line in enumerate(section_lines, start=section_start + 1):
        for is_image, _text, raw_dest in iter_links(line):
            if is_image:
                continue
            href = split_destination(raw_dest)
            href = unquote(href)
            if not href or href.startswith('#'):
                continue
            if is_external_destination(href):
                continue
            if '?' in href:
                href, _query = href.split('?', 1)
            if '#' in href:
                href, _anchor = href.split('#', 1)
            dest_path = resolve_target(README_INDEX_PATH, href)
            if dest_path is None:
                issues.append(Issue(
                    kind="dangling_index_entry",
                    file=str(README_INDEX_PATH.relative_to(ROOT)),
                    link=href,
                    note=f"index entry escapes repository: {href}",
                    line=lineno,
                ))
                continue
            entries.add(dest_path)
            if not dest_path.exists():
                issues.append(Issue(
                    kind="dangling_index_entry",
                    file=str(README_INDEX_PATH.relative_to(ROOT)),
                    link=href,
                    note=f"indexed file missing: {dest_path.relative_to(ROOT)}",
                    line=lineno,
                ))
        for match in code_md_pattern.finditer(line):
            candidate = match.group(1).strip()
            if not candidate:
                continue
            if '#' in candidate:
                candidate, _anchor = candidate.split('#', 1)
            if is_external_destination(candidate):
                continue
            dest_path = resolve_target(README_INDEX_PATH, candidate)
            if dest_path is None:
                issues.append(Issue(
                    kind="dangling_index_entry",
                    file=str(README_INDEX_PATH.relative_to(ROOT)),
                    link=candidate,
                    note=f"index entry escapes repository: {candidate}",
                    line=lineno,
                ))
                continue
            if dest_path not in entries:
                entries.add(dest_path)
            if not dest_path.exists():
                issues.append(Issue(
                    kind="dangling_index_entry",
                    file=str(README_INDEX_PATH.relative_to(ROOT)),
                    link=candidate,
                    note=f"indexed file missing: {dest_path.relative_to(ROOT)}",
                    line=lineno,
                ))
    return entries, issues


def check_orphans(index_entries: Set[Path]) -> List[Issue]:
    issues: List[Issue] = []
    agile_root = DOCS_ROOT / "agile"
    agile_docs = [p for p in agile_root.rglob("*.md") if p.name != "README-agile.md"]
    for path in agile_docs:
        if path in index_entries:
            continue
        issues.append(Issue(
            kind="orphan_doc",
            file=str(path.relative_to(ROOT)),
            link="",
            note=f"not listed in {README_INDEX_PATH.relative_to(ROOT)}",
            line=1,
        ))
    return issues


def emit_issues(issues: Sequence[Issue]) -> None:
    for issue in issues:
        note = issue.note.replace('\n', ' ')
        print(f"::error file={issue.file},line={issue.line},title=DS-14 {note}")


def write_report(issues: Sequence[Issue]) -> None:
    report_payload = {
        "issues": [
            {
                "kind": issue.kind,
                "file": issue.file,
                "link": issue.link,
                "note": issue.note,
            }
            for issue in issues
        ]
    }
    REPORT_PATH.write_text(json.dumps(report_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    if not DOCS_ROOT.exists():
        print("docs directory not found", file=sys.stderr)
        return 0

    md_paths = sorted(DOCS_ROOT.rglob("*.md"))
    anchors_by_path = {path: extract_anchors(path) for path in md_paths}

    issues: List[Issue] = []
    issues.extend(check_links(md_paths, anchors_by_path))

    index_entries, index_issues = collect_index_entries()
    issues.extend(index_issues)
    issues.extend(check_orphans(index_entries))

    write_report(issues)
    if issues:
        emit_issues(issues)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
