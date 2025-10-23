"""Bridge script to invoke the Playwright capture Node tool."""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


def run_capture(url: str) -> int:
    repo_root = Path(__file__).resolve().parent.parent
    script_path = repo_root / "tools" / "ui-poc" / "pw-capture.mjs"
    if not script_path.exists():
        print(f"Capture script not found: {script_path}", file=sys.stderr)
        return 1

    try:
        result = subprocess.run(
            ["node", str(script_path), "--url", url],
            cwd=repo_root,
            check=False,
            timeout=90,
        )
    except subprocess.TimeoutExpired:
        print("Playwright capture timed out after 90 seconds", file=sys.stderr)
        return 1
    except FileNotFoundError:
        print("Node runtime not found; ensure Node.js is installed", file=sys.stderr)
        return 1

    return result.returncode


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the Playwright capture Node script with a URL",
    )
    parser.add_argument(
        "--url",
        required=True,
        help="URL to capture via Playwright",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    return run_capture(args.url)


if __name__ == "__main__":
    sys.exit(main())
