#!/usr/bin/env python3
from __future__ import annotations

import datetime
import json
import os
import re
import sys
from pathlib import Path

try:
    import yaml
except Exception:
    print("::error::PyYAML not installed")
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
NFR_FILE = ROOT / "docs/agile/nfr.yml"
STATE_OUT = ROOT / "docs/agile/nfr-xref-state.json"
REPORT_MD = ROOT / "docs/agile/report.md"


def load_nfrs():
    data = yaml.safe_load(NFR_FILE.read_text(encoding="utf-8"))
    return [n["id"] for n in data.get("nfrs", [])]


PAT = re.compile(r"NFR:\s*([A-Za-z0-9_-]+)")
AREAS = {
    "unit": [ROOT / "tests"],
    "e2e": [ROOT / "tests" / "e2e"],
    "ci": [ROOT / ".github" / "workflows"],
    "docs": [ROOT / "docs"],
}


def scan_ids(paths):
    ids = set()
    for p in paths:
        if not p.exists():
            continue
        for fp in p.rglob("*"):
            if fp.is_file() and fp.stat().st_size < 2_000_000:
                try:
                    for m in PAT.findall(fp.read_text(errors="ignore")):
                        ids.add(m)
                except Exception:
                    pass
    return ids


def main():
    nfr_ids = load_nfrs()
    found = {area: scan_ids(paths) for area, paths in AREAS.items()}
    missing = {n: [a for a in AREAS if n not in found[a]] for n in nfr_ids}

    prev = {}
    if STATE_OUT.exists():
        try:
            prev = json.loads(STATE_OUT.read_text(encoding="utf-8") or "{}")
        except Exception:
            prev = {}

    streak = prev.get("streak", {})
    for n in nfr_ids:
        if len(missing[n]) == len(AREAS):
            streak[n] = streak.get(n, 0) + 1
        elif len(missing[n]) > 0:
            streak[n] = streak.get(n, 0) + 1
        else:
            streak[n] = 0

    THRESH = int(os.environ.get("NFR_XREF_FAIL_STREAK", "2"))
    will_fail = any(v >= THRESH for v in streak.values())

    server_url = os.environ.get("GITHUB_SERVER_URL", "https://github.com")
    repo = os.environ.get("GITHUB_REPOSITORY", "")
    run_id = os.environ.get("GITHUB_RUN_ID", "")
    run_url = f"{server_url}/{repo}/actions/runs/{run_id}"
    lines = []
    for n in nfr_ids:
        miss = ",".join(missing[n]) if missing[n] else "-"
        lines.append(f"| {n} | {miss} | {streak.get(n, 0)} |")
    strict = os.environ.get("NFR_XREF_STRICT", "false").lower() == "true"
    summary = [
        "### DS-15 NFRクロスリファレンス",
        "**Mode:** " + ("STRICT (CI may fail)" if strict else "WARN (no fail)"),
        "",
        "| NFR | 欠落エリア(unit/e2e/ci/docs) | 連続欠落 |",
        "|---|---|---|",
        *lines,
        "",
        f"Run: {run_url}",
    ]
    with open(os.environ.get("GITHUB_STEP_SUMMARY", "/tmp/summary.md"), "a", encoding="utf-8") as w:
        w.write("\n".join(summary) + "\n")

    payload = {
        "streak": streak,
        "generated_at": datetime.datetime.utcnow().isoformat() + "Z",
    }
    STATE_OUT.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    jst_date = datetime.datetime.utcnow() + datetime.timedelta(hours=9)
    branch = os.environ.get("GITHUB_HEAD_REF") or os.environ.get("GITHUB_REF_NAME", "")
    cols = [str(jst_date.date()), "nfr-xref", branch, "-", "-", "-", run_url]
    row = "| " + " | ".join(cols) + " |"
    (ROOT / "docs/agile/.nfr-xref-row").write_text(row, encoding="utf-8")

    if will_fail and strict:
        print("::error::NFR cross-ref deficit exceeded threshold")
        sys.exit(1)
    print("No blocking errors (warn mode).")
    sys.exit(0)


if __name__ == "__main__":
    main()
