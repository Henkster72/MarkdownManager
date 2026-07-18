#!/usr/bin/env python3
"""Show WPM sync and publication status for every vbook instance."""

from __future__ import annotations

import argparse
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo


ROOT = Path("/srv/vbook_web")
LOCAL_TZ = ZoneInfo("Europe/Lisbon")
EXCLUDE_DIRS = {".git", ".mypy_cache", ".pytest_cache", ".wpm-publish", "__pycache__", "node_modules", "output", "venv", ".venv"}
EXCLUDE_FILES = {"image_metadata_cache.json", "template_timestamps.json"}


def relative_age(dt: datetime) -> str:
    now = datetime.now(timezone.utc)
    then = dt.astimezone(timezone.utc)
    seconds = max(0, int((now - then).total_seconds()))
    if seconds < 60:
        return "just now"
    minutes = seconds // 60
    if minutes < 60:
        return f"{minutes} min ago"
    hours = minutes // 60
    if hours < 24:
        return f"{hours}h {minutes % 60}m ago"
    days = hours // 24
    if days < 14:
        return f"{days}d ago"
    return f"{days // 7}w ago"


def format_human_time(value: object) -> str:
    raw = str(value or "").strip()
    if not raw or raw == "never":
        return "never"
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return raw
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)

    local = dt.astimezone(LOCAL_TZ)
    today = datetime.now(LOCAL_TZ).date()
    if local.date() == today:
        label = f"today {local:%H:%M %Z}"
    elif (today - local.date()).days == 1:
        label = f"yesterday {local:%H:%M %Z}"
    else:
        label = f"{local:%a %d %b %H:%M %Z}"
    return f"{label} ({relative_age(dt)})"


def should_skip(path: Path) -> bool:
    return path.name in EXCLUDE_FILES or any(part in EXCLUDE_DIRS for part in path.parts)


def recent_files(root: Path, *, limit: int = 10) -> list[tuple[float, str]]:
    if not root.is_dir():
        return []
    rows: list[tuple[float, str]] = []
    for path in root.rglob("*"):
        if should_skip(path.relative_to(root)) or not path.is_file():
            continue
        try:
            rows.append((path.stat().st_mtime, path.relative_to(root).as_posix()))
        except OSError:
            continue
    rows.sort(reverse=True, key=lambda item: item[0])
    return rows[:limit]


def format_mtime(mtime: float | None) -> str:
    if not mtime:
        return "never"
    return format_human_time(datetime.fromtimestamp(mtime, timezone.utc).isoformat())


def print_table(headers: tuple[str, ...], rows: list[tuple[str, ...]]) -> None:
    widths = [len(header) for header in headers]
    for row in rows:
        widths = [max(width, len(value)) for width, value in zip(widths, row)]
    print("  ".join(header.ljust(width) for header, width in zip(headers, widths)))
    for row in rows:
        print("  ".join(value.ljust(width) for value, width in zip(row, widths)))


def load_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.split("|", 1)[0].strip().strip('"').strip("'")
    return values


def service_status(instance: str) -> str:
    result = subprocess.run(
        ["systemctl", "show", f"wpm-publish@{instance}.service", "--property=Result"],
        text=True,
        capture_output=True,
        check=False,
    )
    values = dict(line.split("=", 1) for line in result.stdout.splitlines() if "=" in line)
    return values.get("Result", "unknown")


def read_status(path: Path) -> dict[str, object]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def instance_records() -> list[dict[str, object]]:
    records: list[dict[str, object]] = []
    for env_path in sorted(ROOT.glob("*/edit/.env")):
        instance = env_path.parent.parent.name
        env = load_env(env_path)
        site_dir_raw = env.get("WPM_SITE_DIR", "")
        if not site_dir_raw:
            continue
        status = read_status(env_path.parent.parent / ".wpm-status.json")
        published = status.get("published", [])
        md_file = str(status.get("last_markdown_change", "")) or "none"
        if isinstance(published, list) and published:
            md_file = "published: " + ", ".join(str(item) for item in published)
        site_dir = Path(site_dir_raw).expanduser()
        newest_site = recent_files(site_dir, limit=1)
        site_mtime, site_file = newest_site[0] if newest_site else (0.0, "none")
        records.append({
            "instance": instance,
            "result": service_status(instance),
            "last_sync": format_human_time(status.get("last_sync_at", "never")),
            "md_time": format_human_time(status.get("last_markdown_change_at", "never")),
            "md_file": md_file,
            "site_time": format_mtime(site_mtime),
            "site_file": site_file,
            "edit_dir": env_path.parent,
            "site_dir": site_dir,
        })
    return records


def print_changes(records: list[dict[str, object]], limit: int) -> None:
    for record in records:
        print()
        print(f"## {record['instance']} recent changed files")
        combined: list[tuple[float, str, str]] = []
        for mtime, rel in recent_files(record["edit_dir"], limit=limit):
            combined.append((mtime, "edit", rel))
        for mtime, rel in recent_files(record["site_dir"], limit=limit):
            combined.append((mtime, "site", rel))
        combined.sort(reverse=True, key=lambda item: item[0])
        rows = [(format_mtime(mtime), source, rel) for mtime, source, rel in combined[:limit]]
        print_table(("TIME", "SRC", "FILE"), rows or [("none", "", "")])


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--changes", action="store_true", help="show the last changed files per WPM instance")
    parser.add_argument("-n", "--limit", type=int, default=10, help="number of changed files to show with --changes")
    args = parser.parse_args()

    records = instance_records()
    rows = [
        (
            str(record["instance"]),
            str(record["result"]),
            str(record["last_sync"]),
            str(record["md_time"]),
            str(record["site_time"]),
            str(record["md_file"]),
            str(record["site_file"]),
        )
        for record in records
    ]
    print_table(("SITE", "RESULT", "LAST SYNC", "LAST MD TIME", "LAST SITE TIME", "LAST MD FILE", "LAST SITE FILE"), rows)
    if args.changes:
        print_changes(records, max(1, args.limit))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
