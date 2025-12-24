# MarkdownManager (flat-file PHP notes) v0.3

![MarkdownManager screenshot](markdownmanager.png)

MarkdownManager is a small, fast app that turns a folder of plain text notes into a clean, searchable notebook you host yourself. No database. No lock-in. Just your files, readable and editable in a friendly web interface.

Sharpen your thinking.

New and exciting: thanks to user input, Mermaid diagram support is now built in. It is still rare to see Mermaid in a lightweight PHP notes app, so this feels like a big win for visual thinkers.

## What's new in 0.3

- Website publication mode for turning Markdown into a publish-ready content flow with metadata, publish states, and strict author/subtitle rules.
- Explorer sorting by date, title, or filename (with the date shown next to the slug).
- Settings upgrades for superusers: app title override and editor view toggles moved into Settings to free toolbar space.
- Mobile and layout refinements for the explorer overlay and header.

## Website publication mode (publisher)

Website publication mode is meant for teams or individuals who want to treat Markdown as a lightweight CMS. It adds structured metadata, publishing states, and stricter content rules while keeping the same flat-file workflow.

### How it works

When enabled, MarkdownManager expects a hidden metadata block at the top of each note. The metadata is stored as special lines that are not rendered in Markdown preview or HTML output.

Example (hidden metadata block):

```text
_page_title: Example page title_
_page_subtitle: Optional subtitle_
_post_date: 2025-11-23_
_published_date: 2025-11-30_
_publishstate: Published_
_author: Jane Doe_
```

Notes:
- Each metadata line uses the format `_key: value_` (leading/trailing underscores are tolerated).
- `published_date` overrides `post_date` when present.
- If no date metadata exists, the explorer falls back to a date prefix in the filename (`yy-mm-dd-`).

### Publish states

Publisher mode adds a publish state selector in the editor:

- Concept
- Processing
- Published

In the overview/explorer, notes are labeled and color-coded by state so you can scan content readiness at a glance.

### Rules enforced in publisher mode

- Requires an author name in Settings.
- Requires a subtitle line starting with `##` (configurable in Settings).
- Disables secret notes.
- Persists theme + language + publisher settings to `metadata_config.json` so the UI stays consistent across devices.

### Why it's useful

- Treat Markdown as a simple CMS without adding a database.
- Keep structure and consistency while still editing in plain text.
- Get a clear overview of what's ready to publish and what isn't.

## Why you'll like it

- Your notes stay yours: everything is regular `.md` files you can open with any editor and back up however you want.
- Simple and fast: designed to be lightweight so browsing and editing feel immediate.
- Friendly writing experience: live preview, readable typography, and a tidy editor that keeps distractions low.
- Easy to personalize: tweak themes or override styles without touching your content.
- Keeps knowledge evergreen: open formats and folders that won't trap your notes in proprietary systems.

## Who it's for

- People who want a private journal or notes app without relying on a cloud service.
- Writers, students, and makers who prefer plain text and quick access.
- Small teams or households that want a tiny internal wiki or a publishing workflow on a LAN.
- Researchers who want a lightweight lab notebook with simple versioning via files.
- Developers who keep project notes, decision logs, or release notes next to code.
- Agencies or freelancers who need a low-friction content staging area before publishing.
- Educators or trainers who maintain lesson notes and share them internally.
- Anyone migrating away from proprietary note apps and wanting a durable archive.

## What you get

- Clean viewer for reading and browsing notes.
- Built-in editor with side-by-side preview and line numbers.
- Quick filtering and folder grouping so you can find things fast.
- Sorting by date, title, or filename.
- Light/dark theme toggle and a few niceties (unsaved-changes prompt, resizable panes).
- Optional shortcut list and a lightweight "secret notes" lock for things you want hidden from casual view.
- Math support for equations when you need it.

## Quick start

From the project directory:

```bash
php -S 127.0.0.1:8000
```

Open `http://127.0.0.1:8000/index.php`.

## A quick note on exposure

MarkdownManager is meant for personal/self-hosted use. It does not provide user accounts or strong encryption. Don't expose it publicly without putting proper access controls in front of it (HTTP auth, VPN, or similar).

## The technical stuff

- `index.php` is the viewer (browse + read).
- `edit.php` is the editor:
  - On large viewports it's a 3-pane layout (file list / Markdown / HTML preview).
  - On small viewports (<= 960px) it becomes a 2-row layout (Markdown + preview) and the file list becomes a toggleable overlay.

Everything you read and edit is stored as normal `*.md` files in this directory (and its subdirectories).

### Editor keyboard shortcuts

When the Markdown textarea is focused:

- Shortcut system: choose Windows/Linux (`Ctrl+Alt`) or Mac (`Ctrl+Command`) in the Settings modal.

- `Ctrl+Z` -- undo (up to 25 steps)
- `Ctrl+Shift+Z` -- redo
- `Ctrl+Alt+B` -- bold (`**...**`)
- `Ctrl+Alt+I` -- italic (`*...*`)
- `Ctrl+Alt+X` -- strikethrough (`~~...~~`)
- `Ctrl+Alt+\`` -- inline code (`` `...` ``)
- `Ctrl+Alt+L` -- insert link (opens the link modal)
- `Ctrl+Alt+K` -- insert link (opens the link modal)
- `Ctrl+Alt+M` -- insert image (opens the image modal)
- `Ctrl+Alt+Q` -- toggle blockquote for line(s) (`> ...`)
- `Ctrl+Alt+U` -- toggle bullet list for line(s) (`- ...`)
- `Ctrl+Alt+O` -- fenced code block (wraps with ``` fences)
- `Ctrl+Alt+/` -- comment selection (`<!-- ... -->`)
- `Ctrl+Alt+PageUp` (or `Ctrl+Alt+Shift+PageUp`) -- uppercase selection (or current word)
- `Ctrl+Alt+PageDown` (or `Ctrl+Alt+Shift+PageDown`) -- lowercase selection (or current word)
- `Ctrl+Alt++` -- increase heading level (`#` -> `##` ...)
- `Ctrl+Alt+-` -- decrease heading level (`##` -> `#` -> none)
- `Ctrl+Alt+1..6` -- set heading level directly

## Features

- Flat-file storage: notes are plain `*.md` files on disk.
- Fast browsing:
  - Root notes and per-folder notes.
  - Sorting: date/title/filename with metadata-aware dates.
  - Folder grouping: subfolders are listed A->Z.
  - Client-side filtering.
- Editor UX:
  - Live HTML preview (server-rendered).
  - Line numbers and word wrap toggles (moved into Settings).
  - Unsaved-changes indicator + "discard changes?" prompt when switching notes.
  - Resizable panes on desktop (saved in `localStorage`).
- Theme toggle (dark/light) stored in `localStorage`.
- Optional shortcuts list via `links.csv`.
- "Secret notes" list (`secret_mds.txt`) protected by a simple session password gate.
- Math typesetting via MathJax (loaded from a CDN by default).
- Superuser settings for publisher mode, app title, theme presets, and metadata visibility.

## Project layout

```text
.
|-- index.php           # viewer (overview + reader + create/delete)
|-- edit.php            # editor (3-pane desktop, 2-row mobile)
|-- i18n.php            # translation loading + helpers
|-- html_preview.php    # shared Markdown->HTML rendering + URL resolution
|-- image_manager.php   # upload/list endpoint for the image manager modal
|-- themes_lib.php      # theme discovery (meta + fonts + available CSS)
|-- static/             # reserved system folder (not shown in overview)
|   |-- base.js         # client-side behavior (filtering, preview, resizers, shortcuts)
|   |-- ui.css          # application layout + UI components
|   |-- markdown.css    # markdown typography (editor + viewer)
|   |-- htmlpreview.css # preview container styling
|   |-- popicon.css     # icon font classes (pi pi-*)
|   `-- popicon.woff2   # icon font file
|-- themes/             # reserved system folder (not shown in overview)
|   |-- Candy_htmlpreview.css
|   |-- Candy_markdown.css
|   |-- Candy_meta.json
|   |-- Candy_fonts.json
|   `-- ...
|-- translations/       # UI translations (auto-detected)
|   |-- en.json
|   |-- nl.json
|   `-- ...
|-- images/             # reserved system folder for uploads (not shown in overview)
|-- links.csv           # optional shortcuts (CSV)
|-- secret_mds.txt      # optional list of \"secret\" markdown paths
`-- <folders>/*.md      # your notes
```

## Requirements

- PHP 8.0+ (uses `str_starts_with` / `str_ends_with`).
- A web server that can run PHP (Apache/Nginx + PHP-FPM), or PHP's built-in dev server.
- Filesystem permissions that allow the PHP process to read/write your `.md` files (for editing/creating/deleting).
  - If you get `Permission denied` when creating folders/files, the directory that contains your notes must be writable by the web server/PHP user.
  - On SELinux systems (Fedora/RHEL/CentOS), you may also need to allow HTTPD writes (e.g. `chcon -R -t httpd_sys_rw_content_t ...`).

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
- Mermaid diagrams (```mermaid fenced blocks, rendered via Mermaid.js from a CDN)
- Blockquotes (`>`)
- Horizontal rules
- GFM-ish tables
- Nested lists via indentation (basic)

### Images and relative paths

- Relative image URLs are resolved from the directory of the current `.md` file.
  - Example: `linux/note.md` with `![x](pic.png)` resolves to `linux/pic.png`.
- `..` path segments are allowed but won't resolve outside the project root.

## Configuration

Configuration is read from a local `.env` file (or real environment variables).
Copy `.env.example` to `.env` and edit as needed.

- `LINKS_CSV` (default: `links.csv`)
- `SECRET_MDS_FILE` (default: `secret_mds.txt`)
- `SECRET_MDS_PASSWORD` (required for unlocking secret notes)
- `PLUGINS_DIR` (default: `plugins`)
- `STATIC_DIR` (default: `static`) -- reserved folder for CSS/JS/fonts (not shown in the overview)
- `IMAGES_DIR` (default: `images`) -- reserved folder for uploaded images (not shown in the overview)
- `THEMES_DIR` (default: `themes`) -- reserved folder for optional theme files (not shown in the overview)
- `TRANSLATIONS_DIR` (default: `translations`) -- reserved folder for UI translation JSON files (auto-detected)

## Theme support

Theme support is intentionally minimal and scoped: it only styles the Markdown editor text area + the HTML preview container. It does not affect the rest of the UI (`static/ui.css`).

### Selecting a theme

- Click the **gear** icon in the header to open the Settings modal.
- Select a preset from the dropdown:
  - The app always loads `static/markdown.css` + `static/htmlpreview.css` first.
  - Then it loads your selected theme CSS (if present) to override the defaults.
- Optional: tweak overrides under "Overrides (optional)" (see below).
- Language: choose your UI language from the **Language** dropdown (auto-detected from `translations/*.json`).

### Translations

- UI strings live in `translations/en.json` (default) and optional overrides like `translations/nl.json`.
- Add another `translations/<code>.json` (e.g. `de.json`) with an `_meta` block (`label` + `native`) and it will appear in the Language dropdown.
- Missing keys fall back to `en.json`.

### How themes are stored (files)

Themes live in `THEMES_DIR` (default: `themes/`) and follow a naming pattern:

- `ThemeName_htmlpreview.css` -- optional, overrides `static/htmlpreview.css`
- `ThemeName_markdown.css` -- optional, overrides `static/markdown.css`

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
- `bg`: the "HTML preview background" used in the theme picker preview
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

Overrides are per-browser/per-device: they're stored in `localStorage` and applied as an extra `<style>` tag.

- Storage key: `mdw-theme-overrides`
- Save behavior: auto-saves as you type; "Save overrides" forces a save immediately.
- "Reset overrides" clears them and returns to pure theme+defaults.

This is meant for small personal tweaks like background color, font size, or accent color--without having to edit theme files on disk.

## HTML export & copy

In `edit.php`, the HTML preview pane has two extra buttons:

- **HTML download**: downloads a clean standalone `.html` file of the current preview
- **Copy HTML**: copies the same standalone HTML to your clipboard

Notes:
- The export uses the current server-rendered preview (same output as the live preview).
- Internal `index.php?file=...` links are rewritten to relative `.md` links so exported HTML is more portable.
- CSS classes are stripped to keep the export "plain".

## Image manager

In `edit.php`, click the **image** icon to open the image manager modal:

- Browse existing images in `IMAGES_DIR` (default: `images/`)
- Upload a new image
- Insert Markdown at the cursor: `![alt](images/filename.ext)`

Implementation notes:
- Upload/list endpoint: `image_manager.php`
- Uses a CSRF token stored in the session.
- If the GD extension is available, uploads may be converted/resized to WebP for consistency; otherwise the original image is stored.
- `IMAGES_DIR` is a reserved folder: it is excluded from the explorer list and folder dropdowns.

## Plugins (optional)

Plugins are optional. If the `PLUGINS_DIR` folder doesn't exist (or is empty), nothing extra is loaded and the app still works normally.

To disable a built-in plugin, remove (or rename) its `.php` file from `PLUGINS_DIR`.

### Built-in plugins

- `plugins/links_plugin.php`: shows the "Shortcuts" section from `links.csv` on the index/overview page.
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
- If it's empty/missing, secret notes stay locked (no login possible).

Important: "secret" is only a lightweight UI/session gate; it does not encrypt files.

### Shortcuts (`links.csv`)

If `links.csv` exists, it is shown as a "Shortcuts" section (via the links plugin).

The parser expects a header row and at least two columns:

```csv
shortcut,url
DuckDuckGo Search,https://duckduckgo.com/
PHP Docs,https://www.php.net/
GitHub,https://github.com/
```

## Troubleshooting

- "Cannot create/delete/save": fix filesystem permissions for the PHP/webserver user.
- "Secret note is locked": open the file in `index.php` first and enter the password.
- Filenames rejected: only paths containing `A-Za-z0-9._-` and unicode letters/numbers are accepted; spaces are not allowed; must end in `.md`.
- Math not rendering: MathJax is loaded from a CDN; offline networks will block it unless you host it locally.

## Changelog

- 0.3: Website publication mode with metadata-driven publish states, author/subtitle requirements, server-saved settings, and UI enhancements (explorer sorting, date display, mobile layout refinements, app title override, settings cleanup).
- 0.2.1: Theme support (file-based themes + per-user overrides), HTML export/copy from the editor, built-in image manager (upload + browse + insert), reserved `themes/` + `images/` folders (configurable in `.env`), improved MathJax rendering in live preview, and a handful of editor/mobile UX fixes (modal overlap, responsive toolbar).
- 0.2: Plugin-based explorer (HTML/PDF/links), shared `explorer_view.php`, improved folder UX (toggle state, back caret), header SVG logo, +MD folder dropdown, internal/external link modal (with search), and `.md` links route via `index.php?file=...` for subfolder installs.
- 0.1.2: Clear filter button + Delete key deletes the current note (preview mode).
- 0.1.1: Markdown images (`![alt](url)`) + relative paths resolved from the `.md` directory.
- 0.1.0: Initial public release.

## TODO (Roadmap)

- [ ] Add functionality for the explorer to drag and drop md files to other folders.
- [ ] Tagging (frontmatter or inline `#tags`) + tag browser.
- [ ] Improve Markdown parser edge cases (nested lists, tables, better code fences).
- [ ] Syntax highlighting in preview (server-side or client-side).
- [ ] Offline-friendly MathJax option (self-hosted instead of CDN).
