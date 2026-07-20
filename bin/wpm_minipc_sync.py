#!/usr/bin/env python3
"""Synchronize one vBook WPM instance with its matching minipc site tree."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(command: list[str]) -> None:
    result = subprocess.run(command, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError((result.stderr or result.stdout or "command failed").strip())


def load_json(path: Path) -> dict:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def pull_markdown(remote: str, remote_edit: str, local_edit: Path) -> None:
    local_edit.mkdir(parents=True, exist_ok=True)
    run([
        "rsync", "-az", "--delete", "--include=*/", "--include=*.md", "--exclude=*",
        "-e", "ssh -o StrictHostKeyChecking=accept-new",
        f"{remote}:{remote_edit.rstrip('/')}/", f"{local_edit}/",
    ])


def pull_remote_state(remote: str, remote_site: str) -> dict:
    with tempfile.TemporaryDirectory(prefix="wpm-minipc-") as tmp:
        target = Path(tmp) / "state.json"
        result = subprocess.run([
            "scp", "-q", "-o", "StrictHostKeyChecking=accept-new",
            f"{remote}:{remote_site.rstrip('/')}/.wpm-publish/state.json", str(target),
        ], text=True, capture_output=True)
        return load_json(target) if result.returncode == 0 else {}


def copy_template(source: str, destination: str) -> None:
    run(["scp", "-q", "-p", "-o", "StrictHostKeyChecking=accept-new", source, destination])


def template_path(rel: str) -> str:
    path = Path(rel)
    return path.with_suffix(".html").as_posix() if path.suffix.lower() == ".md" else path.as_posix()


def sync_templates(remote: str, remote_site: str, site_dir: Path, remote_state: dict, local_state: dict) -> tuple[int, int, int]:
    remote_templates = remote_state.get("templates", {})
    if not isinstance(remote_templates, dict):
        return (0, 0, 0)
    previous = local_state.get("templates", {})
    if not isinstance(previous, dict):
        previous = {}
    next_state: dict[str, str] = {}
    pulled = pushed = deleted = 0

    for rel, previous_hash in previous.items():
        if not isinstance(rel, str) or rel in remote_templates:
            continue
        local_template = site_dir / "templates" / template_path(rel)
        if not local_template.exists():
            continue
        if digest(local_template) != str(previous_hash):
            raise RuntimeError(f"WPM minipc template delete conflict: {rel}")
        local_template.unlink()
        deleted += 1

    for rel, data in remote_templates.items():
        if not isinstance(rel, str) or not isinstance(data, dict):
            continue
        remote_hash = str(data.get("template", ""))
        if not remote_hash:
            continue
        template_rel = template_path(rel)
        local_template = site_dir / "templates" / template_rel
        local_hash = digest(local_template) if local_template.is_file() else ""
        previous_hash = str(previous.get(rel, ""))
        remote_changed = previous_hash != "" and remote_hash != previous_hash
        local_changed = previous_hash != "" and local_hash != previous_hash
        if remote_changed and local_changed and remote_hash != local_hash:
            raise RuntimeError(f"WPM minipc template conflict: {rel}")
        if remote_hash == local_hash:
            next_state[rel] = remote_hash
            continue
        if previous_hash == "":
            local_template.parent.mkdir(parents=True, exist_ok=True)
            copy_template(f"{remote}:{remote_site.rstrip('/')}/templates/{template_rel}", str(local_template))
            next_state[rel] = digest(local_template)
            pulled += 1
            continue
        if remote_changed or not local_template.exists():
            local_template.parent.mkdir(parents=True, exist_ok=True)
            copy_template(f"{remote}:{remote_site.rstrip('/')}/templates/{template_rel}", str(local_template))
            local_hash = digest(local_template)
            pulled += 1
        elif local_changed:
            run(["ssh", "-o", "StrictHostKeyChecking=accept-new", remote, "mkdir", "-p", f"{remote_site.rstrip('/')}/templates/{Path(template_rel).parent.as_posix()}"])
            copy_template(str(local_template), f"{remote}:{remote_site.rstrip('/')}/templates/{template_rel}")
            next_state[rel] = previous_hash
            pushed += 1
            continue
        next_state[rel] = local_hash or remote_hash

    local_state["templates"] = next_state
    return (pulled, pushed, deleted)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--remote", required=True, help="SSH target, for example henk@192.168.1.110")
    parser.add_argument("--remote-site", required=True)
    parser.add_argument("--remote-edit", required=True)
    parser.add_argument("--site-dir", type=Path, required=True)
    parser.add_argument("--local-edit", type=Path, required=True)
    args = parser.parse_args()

    site_dir = args.site_dir.resolve()
    state_dir = site_dir / ".wpm-minipc-sync"
    state_dir.mkdir(parents=True, exist_ok=True)
    state_path = state_dir / "state.json"
    local_state = load_json(state_path)
    pull_markdown(args.remote, args.remote_edit, args.local_edit.resolve())
    remote_state = pull_remote_state(args.remote, args.remote_site)
    pulled, pushed, deleted = sync_templates(args.remote, args.remote_site, site_dir, remote_state, local_state)
    state_path.write_text(json.dumps(local_state, indent=2) + "\n", encoding="utf-8")
    print(f"WPM minipc sync: markdown=pulled templates_pulled={pulled} templates_pushed={pushed} templates_deleted={deleted}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
