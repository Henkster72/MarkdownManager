# MarkdownManager (flat-file PHP notes)

![MarkdownManager screenshot](markdownmanager.png)

MarkdownManager is a small, fast app that turns a folder of plain text notes into a clean, searchable notebook you host yourself. No database. No lock-in. Just your files, readable and editable in a friendly web interface.

Sharpen your thinking.

## Changelog

- 0.2.1: Theme support (file-based themes + per-user overrides), HTML export/copy from the editor, built-in image manager (upload + browse + insert), reserved `themes/` + `images/` folders (configurable in `.env`), improved MathJax rendering in live preview, and a handful of editor/mobile UX fixes (modal overlap, responsive toolbar)
- 0.2: Plugin-based explorer (HTML/PDF/links), shared `explorer_view.php`, improved folder UX (toggle state, back caret), header SVG logo, +MD folder dropdown, internal/external link modal (with search), and `.md` links route via `index.php?file=...` for subfolder installs
- 0.1.2: Clear filter button + Delete key deletes the current note (preview mode)
- 0.1.1: Markdown images (`![alt](url)`) + relative paths resolved from the `.md` directory
- 0.1.0: Initial public release

## TODO (Roadmap)

- [x] Folder toggle in overview (`index.php`): subdirs start collapsed; clicking the folder icon toggles children; use `pi pi-openfolder` for “open” state
- [x] Internal linking between notes (`edit.php` “Add link”): support subdirs + content-aware picker; allow external URLs too with a simple modal
- [x] Add plugins for viewing of different files like PDF and HTML
- [x] Export HTML preview to plain HTML file
- [x] Bug fixes with adding MD files and adding md extension by default 
- [x] Add theming for markdown editor and html preview in edit mode
- [x] Add image upload + insert in edit mode
- [ ] Add functionality for the explorer to drag and drop md files to other folders 
- [ ] Tagging (frontmatter or inline `#tags`) + tag browser
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
├─ html_preview.php    # shared Markdown→HTML rendering + URL resolution
├─ image_manager.php   # upload/list endpoint for the image manager modal
├─ themes_lib.php      # theme discovery (meta + fonts + available CSS)
├─ static/            # reserved system folder (not shown in overview)
│  ├─ base.js         # client-side behavior (filtering, preview, resizers, shortcuts)
│  ├─ ui.css          # application layout + UI components
│  ├─ markdown.css    # markdown typography (editor + viewer)
│  ├─ htmlpreview.css # preview container styling
│  ├─ popicon.css     # icon font classes (pi pi-*)
│  └─ popicon.woff2   # icon font file
├─ themes/            # reserved system folder (not shown in overview)
│  ├─ Candy_htmlpreview.css
│  ├─ Candy_markdown.css
│  ├─ Candy_meta.json
│  ├─ Candy_fonts.json
│  └─ ...
├─ images/            # reserved system folder for uploads (not shown in overview)
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
- `STATIC_DIR` (default: `static`) — reserved folder for CSS/JS/fonts (not shown in the overview)
- `IMAGES_DIR` (default: `images`) — reserved folder for uploaded images (not shown in the overview)
- `THEMES_DIR` (default: `themes`) — reserved folder for optional theme files (not shown in the overview)

## Theme support (0.2.1)

Theme support is intentionally minimal and scoped: it only styles the Markdown editor text area + the HTML preview container. It does not affect the rest of the UI (`static/ui.css`).

### Selecting a theme

- Click the **gear** icon in the header to open the Theme modal.
- Select a preset from the dropdown:
  - The app always loads `static/markdown.css` + `static/htmlpreview.css` first.
  - Then it loads your selected theme CSS (if present) to override the defaults.
- Optional: tweak overrides under “Overrides (optional)” (see below).

### How themes are stored (files)

Themes live in `THEMES_DIR` (default: `themes/`) and follow a naming pattern:

- `ThemeName_htmlpreview.css` — optional, overrides `static/htmlpreview.css`
- `ThemeName_markdown.css` — optional, overrides `static/markdown.css`

You can provide only one of them; the other area simply keeps the defaults.

### Theme metadata (optional)

`ThemeName_meta.json` lets the app show a nicer label and color swatches:

```json
{
  "label": "Candy",
  "color": "#E5219D",
  "bg": "#FFFFFF",
  "secondary": "#FCE7F3"
}
```

- `color`: primary/accent color (used for the theme picker styling + swatch)
- `bg`: the “HTML preview background” used in the theme picker preview
- `secondary`: a softer secondary tone (used by themes for blockquote/code backgrounds)

### Theme fonts (optional)

If your theme uses Google Fonts, add `ThemeName_fonts.json`:

```json
{
  "preconnect": [
    "https://fonts.googleapis.com",
    "https://fonts.gstatic.com"
  ],
  "stylesheets": [
    "https://fonts.googleapis.com/css2?family=Montserrat:wght@100..900&display=swap"
  ]
}
```

When the theme is active, the app injects the relevant `<link rel="preconnect">` and `<link rel="stylesheet">` tags. If you are offline, the browser will fall back to local fonts.

### Overrides (per-user, optional)

Overrides are per-browser/per-device: they’re stored in `localStorage` and applied as an extra `<style>` tag.

- Storage key: `mdw-theme-overrides`
- Save behavior: auto-saves as you type; “Save overrides” forces a save immediately.
- “Reset overrides” clears them and returns to pure theme+defaults.

This is meant for small personal tweaks like background color, font size, or accent color—without having to edit theme files on disk.

## HTML export & copy (0.2.1)

In `edit.php`, the HTML preview pane has two extra buttons:

- **HTML download**: downloads a clean standalone `.html` file of the current preview
- **Copy HTML**: copies the same standalone HTML to your clipboard

Notes:
- The export uses the current server-rendered preview (same output as the live preview).
- Internal `index.php?file=...` links are rewritten to relative `.md` links so exported HTML is more portable.
- CSS classes are stripped to keep the export “plain”.

## Image manager (0.2.1)

In `edit.php`, click the **image** icon to open the image manager modal:

- Browse existing images in `IMAGES_DIR` (default: `images/`)
- Upload a new image
- Insert Markdown at the cursor: `![alt](images/filename.ext)`

Implementation notes:
- Upload/list endpoint: `image_manager.php`
- Uses a CSRF token stored in the session.
- If the GD extension is available, uploads may be converted/resized to WebP for consistency; otherwise the original image is stored.
- `IMAGES_DIR` is a reserved folder: it is excluded from the explorer list and folder dropdowns.

## Notable bug fixes (0.2.1)

- Fixed MathJax not reliably typesetting after live-preview updates.
- Fixed the image modal being “nested” inside the link modal (it only appeared after opening the link modal) and ensured modals don’t overlap.
- Improved mobile ergonomics: responsive toolbar labels and more space for editing/preview.

## Plugins (optional)

Plugins are optional. If the `PLUGINS_DIR` folder doesn’t exist (or is empty), nothing extra is loaded and the app still works normally.

To disable a built-in plugin, remove (or rename) its `.php` file from `PLUGINS_DIR`.

### Built-in plugins

- `plugins/links_plugin.php`: shows the “Shortcuts” section from `links.csv` on the index/overview page.
- `plugins/html_plugin.php`: shows an `HTML/` folder section (lists `.html/.htm` files recursively) on the index/overview page, only if `HTML/` exists.
- `plugins/pdfs_plugin.php`: shows a `PDF/` folder section (lists `.pdf` files recursively) on the index/overview page, only if `PDF/` exists.

Notes:
- Plugins are only loaded in `index.php` (overview/explorer). The editor (`edit.php`) keeps the explorer focused on markdown files.
- Plugin folders also support the same `?folder=...` filtering behavior as markdown folders.

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

If `links.csv` exists, it is shown as a “Shortcuts” section (via the links plugin).

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
