#!/usr/bin/env python3
"""Pull GitHub-owned source trees and deploy only structural site files."""

from __future__ import annotations

import argparse
import fcntl
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from typing import Any


DEFAULT_SITE_ROOT_FILES = ("main.py", "site_config.json")
DEFAULT_TEMPLATE_FILES = ("base.html",)
DEFAULT_TEMPLATE_GLOBS = ("section_*.html", "*_card.htm")
DEFAULT_TEMPLATE_DIRS = ("macros", "layouts")


def run(
    command: list[str],
    *,
    env: dict[str, str] | None = None,
    capture: bool = False,
    cwd: Path | None = None,
) -> str:
    result = subprocess.run(command, text=True, capture_output=capture, env=env, cwd=cwd)
    if result.returncode:
        detail = (result.stderr or result.stdout or "command failed").strip()
        raise RuntimeError(f"{command[0]}: {detail}")
    return result.stdout if capture else ""


def load_config(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or not isinstance(data.get("repos"), list):
        raise RuntimeError("source deploy config must contain a repos list")
    return data


def git_env(key_path: str) -> dict[str, str]:
    env = os.environ.copy()
    env["GIT_SSH_COMMAND"] = (
        f"ssh -i {key_path} -o IdentitiesOnly=yes "
        "-o StrictHostKeyChecking=accept-new"
    )
    return env


def checkout_repo(repo: dict[str, Any], source_root: Path) -> tuple[Path, str, bool]:
    name = str(repo.get("name", "")).strip()
    remote = str(repo.get("remote", "")).strip()
    key = str(repo.get("key", "")).strip()
    if not name or not remote or not key:
        raise RuntimeError("each repo needs name, remote and key")
    cache = source_root / name
    env = git_env(key)
    old = ""
    if (cache / ".git").is_dir():
        old = run(["git", "-C", str(cache), "rev-parse", "HEAD"], env=env, capture=True).strip()
        run(["git", "-C", str(cache), "fetch", "--quiet", "origin", "main"], env=env)
        commit = run(["git", "-C", str(cache), "rev-parse", "origin/main"], env=env, capture=True).strip()
        if commit != old:
            run(["git", "-C", str(cache), "reset", "--hard", "--quiet", "origin/main"], env=env)
    else:
        cache.parent.mkdir(parents=True, exist_ok=True)
        run(["git", "clone", "--quiet", "--branch", "main", "--single-branch", remote, str(cache)], env=env)
        commit = run(["git", "-C", str(cache), "rev-parse", "HEAD"], env=env, capture=True).strip()
    return cache, commit, old != commit


def changed_paths(cache: Path, old: str, new: str) -> list[str]:
    if not old:
        return [path.relative_to(cache).as_posix() for path in cache.rglob("*") if path.is_file() and ".git" not in path.parts]
    output = run(["git", "-C", str(cache), "diff", "--name-only", old, new], capture=True)
    return [line.strip() for line in output.splitlines() if line.strip()]


def copy_file(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists() or source.read_bytes() != target.read_bytes():
        shutil.copy2(source, target)


def site_owned_paths(cache: Path, repo: dict[str, Any]) -> set[str]:
    templates = cache / "templates"
    paths: set[str] = set()
    root_files = repo.get("site_root_files", DEFAULT_SITE_ROOT_FILES)
    template_files = repo.get("template_files", DEFAULT_TEMPLATE_FILES)
    template_globs = repo.get("template_globs", DEFAULT_TEMPLATE_GLOBS)
    template_dirs = repo.get("template_dirs", DEFAULT_TEMPLATE_DIRS)
    for rel in [*root_files, *[f"templates/{name}" for name in template_files]]:
        path = cache / str(rel)
        if path.is_file():
            paths.add(path.relative_to(cache).as_posix())
    for pattern in template_globs:
        for path in templates.glob(str(pattern)):
            if path.is_file():
                paths.add(path.relative_to(cache).as_posix())
    for dirname in template_dirs:
        root = templates / str(dirname)
        if root.is_dir():
            paths.update(
                path.relative_to(cache).as_posix()
                for path in root.rglob("*")
                if path.is_file()
            )
    return paths


def deploy_site_structure(cache: Path, target: Path, repo: dict[str, Any], state: dict[str, Any]) -> int:
    current = site_owned_paths(cache, repo)
    previous = set(state.get("owned_files", []))
    for rel in previous - current:
        stale = target / rel
        if stale.is_file():
            stale.unlink()
    for rel in current:
        copy_file(cache / rel, target / rel)
    state["owned_files"] = sorted(current)
    return len(current)


def deploy_jinja_env(cache: Path, target: Path) -> None:
    target.mkdir(parents=True, exist_ok=True)
    excludes = [
        ".git",
        "__pycache__",
        "*.pyc",
        "node_modules",
        ".venv",
        "venv",
        "venv_jinja",
    ]
    command = ["rsync", "-a", "--delete"]
    for pattern in excludes:
        command.extend(["--exclude", pattern])
    command.extend([f"{cache}/", f"{target}/"])
    run(command)


def load_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.split("|", 1)[0].strip().strip("\"").strip("'")
    return values


def upload_html_output(site_dir: Path) -> None:
    env = load_env(site_dir / ".env")
    host = env.get("SSH_ADDRESS", "")
    user = env.get("SSH_USER", "")
    remote_root = env.get("SSH_DIR", "").rstrip("/")
    output = site_dir / env.get("OUTPUT_DIR", "output")
    if not host or not user or not remote_root:
        raise RuntimeError(f"incomplete SSH upload settings in {site_dir / '.env'}")
    files = [
        path.relative_to(output).as_posix()
        for path in output.rglob("*")
        if path.is_file()
        and "static" not in path.relative_to(output).parts
        and path.suffix.lower() in {".html", ".json", ".xml", ".txt"}
    ]
    if not files:
        raise RuntimeError(f"no HTML output found in {output}")
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False) as handle:
        handle.write("\n".join(files) + "\n")
        files_from = handle.name
    try:
        remote = f"{user}@{host}:{remote_root}/"
        command = ["rsync", "-az", "--whole-file", "--files-from", files_from, "-e", "ssh -F /dev/null"]
        password = env.get("SSH_PWD", "")
        if password:
            command.insert(0, password)
            command.insert(0, "-p")
            command.insert(0, "sshpass")
        command.extend([f"{output}/", remote])
        run(command)
        purge = env.get("SSH_CACHE_PURGE_COMMAND", env.get("CACHE_PURGE_COMMAND", "cache-purge"))
        ssh = ["ssh", "-F", "/dev/null", "-o", "StrictHostKeyChecking=accept-new", f"{user}@{host}", purge]
        if password:
            ssh = ["sshpass", "-p", password, *ssh]
        run(ssh)
    finally:
        Path(files_from).unlink(missing_ok=True)


def render_site(site_dir: Path) -> None:
    driver = (
        "import sys; from pathlib import Path; "
        "site=Path(sys.argv[1]).resolve(); sys.path.insert(0, str(site.parent)); "
        "import main; from jinja_env.site_builder import run_site_build; "
        "(main._write_faq_template(main._load_faq_data()) "
        "if hasattr(main, '_write_faq_template') and hasattr(main, '_load_faq_data') else None); "
        "run_site_build(site, main.load_site_config(), prod_mode=True, full_render=True, purge=False, upload=False)"
    )
    run(
        [sys.executable, "-c", driver, str(site_dir)],
        env={**os.environ, "PYTHONPATH": str(site_dir.parent)},
        cwd=site_dir,
    )


def notify(config: dict[str, Any], title: str, message: str, *, error: bool = False) -> None:
    topic = str(config.get("ntfy_topic", "")).strip()
    if not topic or shutil.which("curl") is None:
        return
    command = [
        "curl", "-sS", "-H", f"Title: {title}",
        "-H", f"Priority: {'5' if error else '3'}",
        "-d", message, f"https://ntfy.sh/{topic}",
    ]
    subprocess.run(command, text=True, capture_output=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    config = load_config(args.config)
    source_root = Path(config.get("source_root", "/home/henk/github_sources")).expanduser()
    state_path = Path(config.get("state_file", source_root / "state.json")).expanduser()
    source_root.mkdir(parents=True, exist_ok=True)
    lock_path = source_root / ".deploy.lock"
    with lock_path.open("w", encoding="utf-8") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print("GitHub source deploy already running")
            return 0
        state = json.loads(state_path.read_text(encoding="utf-8")) if state_path.exists() else {"repos": {}}
        repo_states = state.setdefault("repos", {})
        updates: list[str] = []
        jinja_changed = False
        site_jobs: list[tuple[dict[str, Any], Path, str, str, list[str]]] = []
        for repo in config["repos"]:
            cache, commit, _ = checkout_repo(repo, source_root)
            name = str(repo["name"])
            previous_commit = str(repo_states.get(name, {}).get("deployed_commit", ""))
            paths = changed_paths(cache, previous_commit, commit) if previous_commit != commit else []
            kind = str(repo.get("kind", "site"))
            if previous_commit != commit:
                updates.append(f"{name}@{commit[:12]}")
            if kind == "jinja_env":
                jinja_changed = previous_commit != commit
            elif kind == "site":
                structural = site_owned_paths(cache, repo)
                structural_changed = not previous_commit or any(
                    path in structural
                    or path.startswith("templates/macros/")
                    or path.startswith("templates/layouts/")
                    for path in paths
                )
                site_jobs.append((repo, cache, commit, previous_commit, paths if structural_changed else []))
            else:
                raise RuntimeError(f"unsupported repo kind: {kind}")
        if args.dry_run:
            print("GitHub source deploy: " + (", ".join(updates) if updates else "no updates"))
            return 0
        jinja_repo = next((repo for repo in config["repos"] if repo.get("kind") == "jinja_env"), None)
        if jinja_changed and jinja_repo:
            cache = source_root / str(jinja_repo["name"])
            deploy_jinja_env(cache, Path(str(jinja_repo["target"])).expanduser())
        for repo, cache, commit, previous_commit, paths in site_jobs:
            repo_state = repo_states.setdefault(str(repo["name"]), {})
            if paths:
                count = deploy_site_structure(cache, Path(str(repo["target"])).expanduser(), repo, repo_state)
                print(f"Deployed {count} structural files for {repo['name']}")
            if paths or jinja_changed:
                site_dir = Path(str(repo["target"])).expanduser()
                render_site(site_dir)
                upload_html_output(site_dir)
            repo_state["deployed_commit"] = commit
        if jinja_repo and jinja_changed:
            repo_states[str(jinja_repo["name"])] = {
                "deployed_commit": run(
                ["git", "-C", str(source_root / str(jinja_repo["name"])), "rev-parse", "HEAD"], capture=True
                ).strip()
            }
        state_path.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
        message = "GitHub source deploy: " + (", ".join(updates) if updates else "no updates")
        print(message)
        if updates:
            notify(config, "vBook GitHub source deploy", message)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        config_path = None
        for index, value in enumerate(sys.argv):
            if value == "--config" and index + 1 < len(sys.argv):
                config_path = Path(sys.argv[index + 1])
                break
        if config_path and config_path.is_file():
            try:
                notify(load_config(config_path), "vBook GitHub source deploy mislukt", str(exc), error=True)
            except Exception:
                pass
        print(f"GitHub source deploy failed: {exc}", file=sys.stderr)
        raise
