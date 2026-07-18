#!/usr/bin/env python3
"""Publish reviewed WPM Markdown through an AW-SSG site build."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.parse
from pathlib import Path


CORE_MARKDOWN = {"README.md", "CHANGELOG.md", "voorbeeld_markdown.md", "tutorial_markdowneditor.md"}
PUBLISHSTATE_RE = re.compile(r"^\{\s*publishstate\s*:\s*.*?\s*\}$", re.IGNORECASE | re.MULTILINE)


def load_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.split("|", 1)[0].strip().strip('"').strip("'")
    return values


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def markdown_files(root: Path) -> dict[str, Path]:
    return {
        path.relative_to(root).as_posix(): path
        for path in root.rglob("*.md")
        if path.name not in CORE_MARKDOWN and ".wpm-" not in path.parts
    }


def publish_state(path: Path) -> str:
    for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw.strip()
        if not line:
            break
        match = re.match(r"^\{\s*publishstate\s*:\s*(.*?)\s*\}$", line, re.IGNORECASE)
        if match:
            return match.group(1).strip().lower()
    return "concept"


def run(command: list[str], *, cwd: Path | None = None, capture: bool = False) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(command, cwd=cwd, text=True, capture_output=capture)
    if result.returncode:
        detail = (result.stderr or result.stdout or "command failed").strip()
        label = command[2] if len(command) > 2 and command[0] == "sshpass" else command[0]
        raise RuntimeError(f"{label}: {detail}")
    return result


def ssh_prefix(env: dict[str, str]) -> list[str]:
    password = env.get("SSH_PWD", "")
    return ["sshpass", "-p", password] if password else []


def remote_spec(env: dict[str, str], suffix: str = "") -> str:
    host, user, root = env.get("SSH_ADDRESS", ""), env.get("SSH_USER", ""), env.get("SSH_DIR", "")
    if not all((host, user, root)):
        raise RuntimeError("SSH_ADDRESS, SSH_USER and SSH_DIR are required")
    return f"{user}@{host}:{root.rstrip('/')}/{suffix.lstrip('/')}"


def pull_markdown(editor_env: dict[str, str], staging: Path) -> None:
    remote = remote_spec(editor_env, editor_env.get("WPM_SYNC_REMOTE_EDIT_DIR", "edit")) + "/"
    command = ssh_prefix(editor_env) + [
        "rsync", "-az", "--delete", "--include=*/", "--include=*.md", "--include=**/*.md", "--exclude=*",
        "-e", "ssh -F /dev/null -o StrictHostKeyChecking=accept-new", remote, f"{staging}/",
    ]
    run(command)


def load_state(path: Path) -> dict[str, str]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        files = data.get("files", {}) if isinstance(data, dict) else {}
        return {str(k): str(v) for k, v in files.items()} if isinstance(files, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def sync_shadow(staging: Path, shadow: Path, known: dict[str, str]) -> tuple[dict[str, Path], dict[str, Path], list[str]]:
    remote_files = markdown_files(staging)
    active_files: dict[str, Path] = {}
    conflicts: list[str] = []
    for rel, source in remote_files.items():
        target = shadow / rel
        remote_hash = digest(source)
        local_hash = digest(target) if target.exists() else ""
        previous = known.get(rel, "")
        copy_remote = not target.exists()
        if local_hash and local_hash != remote_hash:
            if not previous:
                copy_remote = target.stat().st_mtime <= source.stat().st_mtime
            else:
                local_changed = local_hash != previous
                remote_changed = remote_hash != previous
                if local_changed and remote_changed:
                    conflicts.append(rel)
                    continue
                copy_remote = remote_changed and not local_changed
        if copy_remote:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(source.read_bytes())
        active_files[rel] = target
    return remote_files, active_files, conflicts


def export_template(editor_url: str, rel: str, source: Path, target: Path) -> None:
    url = f"{editor_url}?file={urllib.parse.quote(rel, safe='/')}&preview=1&template=jinja"
    result = run(["curl", "--fail", "--silent", "--show-error", "-F", f"content=<{source}", url], capture=True)
    template = result.stdout
    if not template.lstrip().startswith("{% extends"):
        raise RuntimeError(f"AW-SSG export returned no Jinja template for {rel}")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(template, encoding="utf-8")


def render_site(site_dir: Path) -> None:
    driver = (
        "import sys; from pathlib import Path; "
        "site=Path(sys.argv[1]).resolve(); sys.path.insert(0, str(site.parent)); "
        "import main; from jinja_env.site_builder import run_site_build; "
        "main._write_faq_template(main._load_faq_data()); "
        "run_site_build(site, main.load_site_config(), prod_mode=True, full_render=False, purge=False, upload=False)"
    )
    run([sys.executable, "-c", driver, str(site_dir)], cwd=site_dir)


def output_paths(rel: str) -> list[str]:
    parts = Path(rel).with_suffix("").parts
    if len(parts) == 1:
        return [f"{parts[0]}/index.html", "page_references.json", "sitemap.xml", "robots.txt"]
    return [
        f"{'/'.join(parts)}/index.html",
        f"{parts[0]}/index.html",
        "page_references.json",
        "sitemap.xml",
        "robots.txt",
    ]


def upload_outputs(site_env: dict[str, str], site_dir: Path, rel: str) -> None:
    output_dir = site_dir / site_env.get("OUTPUT_DIR", "output")
    paths = [path for path in output_paths(rel) if (output_dir / path).is_file()]
    if not paths:
        raise RuntimeError(f"no generated output found for {rel}")
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False) as handle:
        handle.write("\n".join(paths) + "\n")
        files_from = handle.name
    try:
        remote_root = remote_spec(site_env)
        command = ssh_prefix(site_env) + [
            "rsync", "-az", "--whole-file", "--files-from", files_from,
            "-e", "ssh -F /dev/null -o StrictHostKeyChecking=accept-new",
            f"{output_dir}/", f"{remote_root}/",
        ]
        run(command)
    finally:
        Path(files_from).unlink(missing_ok=True)


def set_published(path: Path) -> None:
    content = path.read_text(encoding="utf-8")
    updated, count = PUBLISHSTATE_RE.subn("{publishstate: Published}", content, count=1)
    if count != 1:
        raise RuntimeError(f"missing publishstate metadata in {path}")
    path.write_text(updated, encoding="utf-8")


def push_markdown(editor_env: dict[str, str], source: Path, rel: str) -> None:
    remote_file = remote_spec(editor_env, f"{editor_env.get('WPM_SYNC_REMOTE_EDIT_DIR', 'edit').strip('/')}/{rel}")
    remote_parent = remote_file.rsplit("/", 1)[0]
    command = ssh_prefix(editor_env) + ["ssh", "-o", "StrictHostKeyChecking=accept-new", remote_file.split(":", 1)[0], f"mkdir -p {remote_parent.split(':', 1)[1]}"]
    run(command)
    run(ssh_prefix(editor_env) + ["scp", "-O", str(source), remote_file])


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--site-dir", type=Path, required=True)
    parser.add_argument("--shadow-dir", type=Path, required=True)
    parser.add_argument("--editor-url", required=True)
    args = parser.parse_args()

    site_dir, shadow_dir = args.site_dir.resolve(), args.shadow_dir.resolve()
    editor_env = load_env(shadow_dir / ".env")
    site_env = load_env(site_dir / ".env")
    state_dir = site_dir / ".wpm-publish"
    staging = state_dir / "remote"
    state_path = state_dir / "state.json"
    state_dir.mkdir(parents=True, exist_ok=True)
    staging.mkdir(parents=True, exist_ok=True)

    pull_markdown(editor_env, staging)
    known = load_state(state_path)
    remote_files, active_files, conflicts = sync_shadow(staging, shadow_dir, known)
    if conflicts:
        raise RuntimeError("WPM sync conflict: " + ", ".join(conflicts))

    processed: list[str] = []
    for rel, source in active_files.items():
        if publish_state(source) != "processing":
            continue
        template = site_dir / "templates" / Path(rel).with_suffix(".html")
        export_template(args.editor_url, rel, source, template)
        render_site(site_dir)
        upload_outputs(site_env, site_dir, rel)
        set_published(source)
        push_markdown(editor_env, source, rel)
        processed.append(rel)

    next_state = {rel: digest(path) for rel, path in remote_files.items()}
    for rel in processed:
        next_state[rel] = digest(active_files[rel])
    state_path.write_text(json.dumps({"files": next_state}, indent=2) + "\n", encoding="utf-8")
    print("WPM publish: " + (", ".join(processed) if processed else "no Processing files"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
