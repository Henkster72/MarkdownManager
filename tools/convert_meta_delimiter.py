#!/usr/bin/env python3
import argparse
import os
import sys
from typing import Iterable, Tuple


UNDERSCORE_RE = r'^(\s*)_+([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*?)\s*_*\s*$'
BRACE_RE = r'^(\s*)\{+\s*([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*?)\s*\}+\s*$'


def split_line(line: str) -> Tuple[str, str]:
    if line.endswith('\r\n'):
        return line[:-2], '\r\n'
    if line.endswith('\n') or line.endswith('\r'):
        return line[:-1], line[-1]
    return line, ''


def parse_meta_line(line: str):
    import re
    m = re.match(BRACE_RE, line)
    if m:
        return ('brace', m.group(1), m.group(2), m.group(3).strip())
    m = re.match(UNDERSCORE_RE, line)
    if m:
        return ('underscore', m.group(1), m.group(2), m.group(3).strip())
    return None


def convert_content(text: str) -> Tuple[str, bool, int]:
    lines = text.splitlines(keepends=True)
    if not lines:
        return text, False, 0

    out = []
    changed = False
    converted = 0
    in_meta = True
    seen_meta = False

    for idx, line in enumerate(lines):
        body, nl = split_line(line)
        bom = ''
        body_match = body
        if idx == 0 and body.startswith('\ufeff'):
            bom = '\ufeff'
            body_match = body[1:]

        if in_meta:
            parsed = parse_meta_line(body_match)
            if parsed:
                kind, indent, key, value = parsed
                seen_meta = True
                if kind == 'underscore':
                    new_line = f'{bom}{indent}{{{key}: {value}}}{nl}'
                    if new_line != line:
                        changed = True
                        converted += 1
                    out.append(new_line)
                else:
                    out.append(line)
                continue
            if not seen_meta and body_match.strip() == '':
                out.append(line)
                continue
            in_meta = False

        out.append(line)

    return ''.join(out), changed, converted


def iter_md_files(root: str, include_hidden: bool) -> Iterable[str]:
    skip_dirs = {'.git', '.hg', '.svn', '__pycache__'}
    root = os.path.abspath(root)
    for dirpath, dirnames, filenames in os.walk(root):
        if not include_hidden:
            dirnames[:] = [d for d in dirnames if not d.startswith('.') and d not in skip_dirs]
        else:
            dirnames[:] = [d for d in dirnames if d not in skip_dirs]

        for name in filenames:
            if not include_hidden and name.startswith('.'):
                continue
            if not name.lower().endswith('.md'):
                continue
            yield os.path.join(dirpath, name)


def process_file(path: str, dry_run: bool) -> Tuple[bool, int]:
    try:
        with open(path, 'r', encoding='utf-8', newline='') as fh:
            original = fh.read()
    except OSError as exc:
        print(f'! Failed to read {path}: {exc}', file=sys.stderr)
        return False, 0

    updated, changed, converted = convert_content(original)
    if not changed:
        return False, 0

    if dry_run:
        return True, converted

    try:
        with open(path, 'w', encoding='utf-8', newline='') as fh:
            fh.write(updated)
    except OSError as exc:
        print(f'! Failed to write {path}: {exc}', file=sys.stderr)
        return False, 0

    return True, converted


def detect_default_root() -> str:
    cwd = os.path.abspath(os.getcwd())
    script_dir = os.path.dirname(os.path.abspath(__file__))
    if os.path.basename(script_dir) == 'tools':
        return os.path.dirname(script_dir)
    if os.path.basename(cwd) == 'tools':
        return os.path.dirname(cwd)
    return cwd


def main() -> int:
    parser = argparse.ArgumentParser(
        description='Convert legacy _key: value_ metadata lines to {key: value} in Markdown files.'
    )
    parser.add_argument(
        'path',
        nargs='?',
        default=None,
        help='Root folder (or a single .md file) to process. Defaults to project root when run from tools/.',
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would change without writing files.',
    )
    parser.add_argument(
        '--include-hidden',
        action='store_true',
        help='Include hidden files and directories.',
    )
    args = parser.parse_args()

    target = os.path.abspath(args.path) if args.path else detect_default_root()
    if os.path.isfile(target):
        if not target.lower().endswith('.md'):
            print(f'! Not a .md file: {target}', file=sys.stderr)
            return 2
        changed, converted = process_file(target, args.dry_run)
        if changed:
            action = 'would update' if args.dry_run else 'updated'
            print(f'{action}: {target} ({converted} meta line(s))')
        return 0

    if not os.path.isdir(target):
        print(f'! Path not found: {target}', file=sys.stderr)
        return 2

    total_files = 0
    total_lines = 0
    changed_files = 0

    for path in iter_md_files(target, args.include_hidden):
        changed, converted = process_file(path, args.dry_run)
        total_files += 1
        if changed:
            changed_files += 1
            total_lines += converted
            action = 'would update' if args.dry_run else 'updated'
            print(f'{action}: {path} ({converted} meta line(s))')

    print(
        f'Done. {changed_files}/{total_files} file(s) '
        f'{"would be " if args.dry_run else ""}updated, '
        f'{total_lines} line(s) converted.'
    )
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
