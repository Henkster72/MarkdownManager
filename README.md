# MarkdownManager

Self-hosted Markdown notes viewer + editor built with plain PHP and flat files (no database).

## Quick start

From the project directory:

```bash
php -S 127.0.0.1:8000
```

Open `http://127.0.0.1:8000/index.php`.

## Features

- Browse notes in the repo root and subfolders; client-side filtering.
- Sort: newest-first when filename starts with `yy-mm-dd-`, otherwise A→Z.
- Editor with live HTML preview and line numbers.
- Light/dark theme toggle (stored in `localStorage`).
- Optional shortcuts list via `links.csv`.
- Optional “secret notes” list (`secret_mds.txt`) protected by a simple session password gate.
- Math typesetting via MathJax (loaded from a CDN by default).

## Project layout

```text
.
├─ index.php          # viewer (overview + reader + create/delete)
├─ edit.php           # editor (3-pane desktop, 2-row mobile)
├─ base.js            # client-side behavior (filtering, preview, resizers, shortcuts)
├─ ui.css             # application layout + UI components
├─ markdown.css       # markdown typography (editor + viewer)
├─ htmlpreview.css    # preview container styling
├─ popicon.css        # icon font classes (pi pi-*)
├─ popicon.woff2      # icon font file
├─ links.csv          # optional shortcuts (CSV)
├─ secret_mds.txt     # optional list of “secret” markdown paths
└─ <folders>/*.md     # your notes
```

## Requirements

- PHP 8.0+ (uses `str_starts_with` / `str_ends_with`).
- A web server that can run PHP (Apache/Nginx + PHP-FPM), or PHP’s built-in dev server.
- Filesystem permissions that allow the PHP process to read/write your `.md` files (for editing/creating/deleting).

## Markdown support

Rendering is implemented in PHP (a small custom parser) and is used by both `index.php` and `edit.php`.

Supported:

- Headings (`#` through `######`)
- Paragraphs
- Inline code (`` `code` ``)
- Bold / italic (`**bold**`, `*italic*`)
- Images (`![alt](url)`)
- Links (`[label](https://example.com)`)
- Fenced code blocks (```), with optional language token
- Blockquotes (`>`)
- Horizontal rules
- GFM-ish tables
- Nested lists via indentation (basic)

### Images and relative paths

- Relative image URLs are resolved from the directory of the current `.md` file.
  - Example: `linux/note.md` with `![x](pic.png)` resolves to `linux/pic.png`.
- `..` path segments are allowed but won’t resolve outside the project root.

## Configuration

### Secret notes

`secret_mds.txt` is a newline-separated list of relative Markdown paths to protect:

```text
finance/private.md
research/25-01-01-secret-note.md
```

Password:
- The password is currently set in code as `$SECRET_MDS_PASSWORD` in both `index.php` and `edit.php`.
- If you change it, change it in both files so the viewer/editor stay in sync.

Important: “secret” is only a lightweight UI/session gate; it does not encrypt files.

### Shortcuts (`links.csv`)

If `links.csv` exists, it is shown as a “Shortcuts” section.

CSV format:

```csv
shortcut,url
DuckDuckGo Search,https://duckduckgo.com/
PHP Docs,https://www.php.net/
GitHub,https://github.com/
```

## Security notes

This project is designed for personal/self-hosted use and intentionally stays simple.

- No user management, no per-note ACL, and no encryption.
- Do not expose this directly to the public internet without putting proper access controls in front of it (VPN, HTTP auth, reverse-proxy authentication, etc).

## Troubleshooting

- “Cannot create/delete/save”: fix filesystem permissions for the PHP/webserver user.
- “Secret note is locked”: open the file in `index.php` first and enter the password.
- Filenames rejected: only paths containing `A-Za-z0-9._-` and unicode letters/numbers are accepted; spaces are not allowed; must end in `.md`.
- Math not rendering: MathJax is loaded from a CDN; offline networks will block it unless you host it locally.
