# MarkdownManager (flat-file PHP notes)

![MarkdownManager screenshot](markdownmanager.png)

MarkdownManager is a small, fast app that turns a folder of plain text notes into a clean, searchable notebook you host yourself. No database. No lock-in. Just your files, readable and editable in a friendly web interface.

Sharpen your thinking.

## Changelog

- 0.2: Plugin-based explorer (HTML/PDF/links), shared `explorer_view.php`, improved folder UX (toggle state, back caret), header SVG logo, +MD folder dropdown, internal/external link modal (with search), and `.md` links route via `index.php?file=...` for subfolder installs
- 0.1.2: Clear filter button + Delete key deletes the current note (preview mode)
- 0.1.1: Markdown images (`![alt](url)`) + relative paths resolved from the `.md` directory
- 0.1.0: Initial public release

## TODO (Roadmap)

- [x] Folder toggle in overview (`index.php`): subdirs start collapsed; clicking the folder icon toggles children; use `pi pi-openfolder` for “open” state
- [x] Internal linking between notes (`edit.php` “Add link”): support subdirs + content-aware picker; allow external URLs too with a simple modal
- [x] Add plugins for viewing of different files like PDF and HTML
- [ ] Add functionality for the explorer to drag and drop md files to other folders 
- [ ] Tagging (frontmatter or inline `#tags`) + tag browser
- [ ] Add theming for markdown editor and html preview in edit mode
- [ ] Improve Markdown parser edge cases (nested lists, tables, better code fences)
- [ ] Syntax highlighting in preview (server-side or client-side)
- [ ] Offline-friendly MathJax option (self-hosted instead of CDN)
- [ ] Better mobile editor ergonomics (toolbar, larger tap targets, quicker pane toggle)

## Why you’ll like it

- Your notes stay yours: everything is regular `.md` files you can open with any editor and back up however you want.
- Simple and fast: designed to be lightweight so browsing and editing feel immediate.
- Friendly writing experience: live preview, readable typography, and a tidy editor that keeps distractions low.
- Easy to personalize: tweak a few stylesheets to match your taste.
- Keeps knowledge evergreen: open formats and folders that won’t trap your notes in proprietary systems.

## Who it’s for

- People who want a private journal or notes app without relying on a cloud service.
- Writers, students, and makers who prefer plain text and quick access.
- Small teams or households that want a tiny internal wiki or project notes on a LAN.

## What you get

- Clean viewer for reading and browsing notes.
- Built-in editor with side-by-side preview and line numbers.
- Quick filtering and folder grouping so you can find things fast.
- Light/dark theme toggle and a few niceties (unsaved-changes prompt, resizable panes).
- Optional shortcut list and a lightweight “secret notes” lock for things you want hidden from casual view.
- Math support for equations when you need it.

## Quick start

From the project directory:

```bash
php -S 127.0.0.1:8000
```

Open `http://127.0.0.1:8000/index.php`.

## A quick note on exposure

MarkdownManager is meant for personal/self-hosted use. It does not provide user accounts or strong encryption. Don’t expose it publicly without putting proper access controls in front of it (HTTP auth, VPN, or similar).

## The technical stuff

- `index.php` is the viewer (browse + read).
- `edit.php` is the editor:
  - On large viewports it’s a 3-pane layout (file list / Markdown / HTML preview).
  - On small viewports (≤ 960px) it becomes a 2-row layout (Markdown + preview) and the file list becomes a toggleable overlay.

Everything you read and edit is stored as normal `*.md` files in this directory (and its subdirectories).

## Features

- Flat-file storage: notes are plain `*.md` files on disk.
- Fast browsing:
  - Root notes and per-folder notes.
  - Sorting: newest-first when filename starts with `yy-mm-dd-`, otherwise A→Z.
  - Folder grouping: subfolders are listed A→Z.
  - Client-side filtering.
- Editor UX:
  - Live HTML preview (server-rendered).
  - Line numbers.
  - Unsaved-changes indicator + “discard changes?” prompt when switching notes.
  - Resizable panes on desktop (saved in `localStorage`).
- Theme toggle (dark/light) stored in `localStorage`.
- Optional shortcuts list via `links.csv`.
- “Secret notes” list (`secret_mds.txt`) protected by a simple session password gate.
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

## Markdown rendering

Rendering is implemented in PHP (a small custom parser) and is used by both `index.php` and `edit.php`.

It supports a practical subset:

- Headings (`#` through `######`)
- Paragraphs
- Inline code (`` `code` ``)
- Bold / italic (`**bold**`, `*italic*`)
- Images (`![alt](url)`) including relative paths
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

Configuration is read from a local `.env` file (or real environment variables).
Copy `.env.example` to `.env` and edit as needed.

- `LINKS_CSV` (default: `links.csv`)
- `SECRET_MDS_FILE` (default: `secret_mds.txt`)
- `SECRET_MDS_PASSWORD` (required for unlocking secret notes)
- `PLUGINS_DIR` (default: `plugins`)

### Secret notes

`secret_mds.txt` is a newline-separated list of relative markdown paths to protect:

```text
finance/private.md
research/25-01-01-secret-note.md
```

Password:
- Set `SECRET_MDS_PASSWORD` in `.env`.
- If it’s empty/missing, secret notes stay locked (no login possible).

Important: “secret” is only a lightweight UI/session gate; it does not encrypt files.

### Shortcuts (`links.csv`)

If `links.csv` exists, it is shown as a “Shortcuts” section (via the `links_plugin.php` plugin).

The parser expects a header row and at least two columns:

```csv
shortcut,url
DuckDuckGo Search,https://duckduckgo.com/
PHP Docs,https://www.php.net/
GitHub,https://github.com/
```

## Troubleshooting

- “Cannot create/delete/save”: fix filesystem permissions for the PHP/webserver user.
- “Secret note is locked”: open the file in `index.php` first and enter the password.
- Filenames rejected: only paths containing `A-Za-z0-9._-` and unicode letters/numbers are accepted; spaces are not allowed; must end in `.md`.
- Math not rendering: MathJax is loaded from a CDN; offline networks will block it unless you host it locally.
