<<<<<<< HEAD
# MarkdownManager (flat-file PHP notes)

Sharpen your thinking.

MarkdownManager is a **fast, flexible, self-hosted** Markdown viewer + editor for your private notes — built with **plain PHP**, **zero database**, and files you can open with any editor.

- `index.php` is the **viewer** (browse + read).
- `edit.php` is the **editor**:
  - On large viewports it’s a **3-pane layout** (file list / Markdown / HTML preview).
  - On small viewports (≤ `960px`) it becomes a **2-row layout** (Markdown + preview) and the file list becomes a **toggleable overlay**.

Everything you read and edit is stored as normal `*.md` files in this directory (and its subdirectories).

## Why this exists

- **Your thoughts stay yours**: notes live on your disk as `*.md` files, so they’re quick to load and easy to back up.
- **Your workflow is yours**: the whole UI is just `*.php`, `*.js`, and `*.css` — straightforward to tweak and extend.
- **Your knowledge should last**: open formats, simple folder structures, and no database lock-in.
- **Make it look like you**: customize the reading/editor typography by editing `markdown.css` and `htmlpreview.css` (and the overall app chrome in `ui.css`).

Use cases: personal notes, journaling, a lightweight knowledge base, project notes, or a small internal wiki.

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

- PHP **8.0+** (uses `str_starts_with` / `str_ends_with`).
- A web server that can run PHP (Apache/Nginx + PHP-FPM), or PHP’s built-in dev server.
- Filesystem permissions that allow the PHP process to **read/write** your `.md` files (for editing/creating/deleting).

## Installation

### Option A: PHP built-in server (quick local use)

From the project directory:

```bash
php -S 127.0.0.1:8000
```

Then open:

- `http://127.0.0.1:8000/index.php`

Notes:
- This is intended for local/dev usage. For sharing on a network, prefer a real web server + proper access controls.

### Option B: Apache or Nginx (typical self-hosting)

1. Put the project in a web-accessible directory (or point a vhost to it).
2. Ensure PHP is enabled (mod_php or PHP-FPM).
3. Visit `index.php` in your browser.

Permissions checklist (common gotcha):
- The user your web server runs as (e.g. `www-data`, `apache`, `nginx`) must be able to:
  - read all `*.md` files you want to view
  - write files you want to edit
  - create new `*.md` files
  - delete `*.md` files (from the UI)

## How it works

### Viewer (`index.php`)

`index.php` has three “modes”:

- **Overview mode** (no `file` parameter):
  - Lists notes in the repo root and in subfolders.
  - Supports filtering.
  - Shows optional “Shortcuts” from `links.csv`.
  - Allows creating a new note (`+MD`) and deleting notes.
- **View mode** (`index.php?file=path/to/note.md`):
  - Renders the selected markdown file to HTML (server-side).
  - Provides an “Edit” button that opens the editor for that file.
- **Secret prompt mode**:
  - If the requested file is listed in `secret_mds.txt` and you are not authenticated, a password prompt is shown.
  - After entering the password, the session is marked as unlocked (`$_SESSION['secret_ok']`).

Supported URL parameters:
- `file`: relative path to a `.md` file, e.g. `finance/25-12-12-Note.md`
- `folder`: filter overview to a folder name or `root`
- `q`: initial filter query (pre-fills filter input)
- `focus`: used by keyboard navigation to focus a specific item in overview
- `new=1`: opens the “New markdown” panel on page load

Also supported:
- “Shorthand” URLs without `file=`, e.g. `index.php?finance/25-12-12-Note.md`

Creating a note:
- The folder must already exist (the UI does not create directories).
- Filenames must end in `.md`.
- If content is empty, a default `# Title` is generated from the filename.

Deleting a note:
- Deletes the file from disk (`unlink`).
- A JS confirmation dialog is shown.
- Protected by a CSRF token stored in the session.

### Editor (`edit.php`)

`edit.php` is a 3-pane editor on desktop:

1. **Left pane**: note list + filter
2. **Middle pane**: markdown textarea editor (with line numbers)
3. **Right pane**: rendered HTML preview

Responsive behavior (CSS in `ui.css`):
- Under `960px`:
  - The editor becomes a 2-row layout (Markdown on top, preview below).
  - The file list is hidden by default and can be opened as an overlay via the “list” button.
  - Column resizers are hidden.

Live preview:
- Client sends the current textarea content to `edit.php?file=...&preview=1` via `POST`.
- Server renders HTML and returns it; the page replaces the preview content.

SPA-like navigation:
- Clicking a note in the left pane does not reload the full page.
- The client fetches `edit.php?file=...&json=1`, which returns:
  - raw markdown content
  - rendered HTML
  - title extracted from the markdown
- The editor updates the UI and uses `history.pushState(...)` to update the URL.

Save behavior:
- Saves to a `*.tmp` file first and then renames it over the original file.

Secret notes:
- If a file is listed in `secret_mds.txt` and the session is not unlocked, the editor redirects back to `index.php` for the password prompt.

### Markdown rendering

Rendering is implemented in PHP (a small custom parser) and is used by both `index.php` and `edit.php`.

It supports a practical subset:
- Headings (`#` through `######`)
- Paragraphs
- Inline code (`` `code` ``)
- Bold / italic (`**bold**`, `*italic*`)
- Links (`[label](https://example.com)`)
- Fenced code blocks (```), with optional language token
- Blockquotes (`>`)
- Horizontal rules
- GFM-ish tables
- Nested lists via indentation (basic)

If you rely on features outside this subset (e.g. images), you’ll likely want to extend the parser or swap it for a library.

## Configuration

### Secret notes

`secret_mds.txt` is a newline-separated list of **relative markdown paths** to protect:

```text
finance/private.md
research/25-01-01-secret-note.md
```

Password:
- The password is currently set in code as `$SECRET_MDS_PASSWORD` in both `index.php` and `edit.php`.
- If you change it, change it in **both** files so the viewer/editor stay in sync.

Important: “secret” is only a lightweight UI/session gate; it does not encrypt files.

### Shortcuts (`links.csv`)

If `links.csv` exists, it is shown as a “Shortcuts” section.

The parser expects a header row and at least two columns:

```csv
shortcut,url
DuckDuckGo Search,https://duckduckgo.com/
PHP Docs,https://www.php.net/
Github,https://www.github.com/
Markdown tutorial on Youtube,https://www.youtube.com/watch?v=_PPWWRV6gbA
```

## Security notes (read before exposing)

This project is designed for personal/self-hosted use and intentionally stays simple.

- There is no user management, no per-note ACL, and no encryption.
- The “secret notes” feature is a session flag + a hardcoded password.
- Do not expose this directly to the public internet. Prefer:
  - running it only on localhost
  - restricting access to your LAN/VPN
  - putting it behind HTTP auth / SSO / reverse-proxy authentication

## Troubleshooting

- “Cannot create/delete/save”: fix filesystem permissions for the PHP/webserver user.
- “Secret note is locked”: open the file in `index.php` first and enter the password.
- Filenames rejected: only paths containing `A-Za-z0-9._-` and unicode letters/numbers are accepted; spaces are not allowed; must end in `.md`.
- Math not rendering: MathJax is loaded from a CDN; offline networks will block it unless you host it locally.
=======
# MarkdownManager (flat-file PHP notes)

Sharpen your thinking.

MarkdownManager is a **fast, flexible, self-hosted** Markdown viewer + editor for your private notes — built with **plain PHP**, **zero database**, and files you can open with any editor.

- `index.php` is the **viewer** (browse + read).
- `edit.php` is the **editor**:
  - On large viewports it’s a **3-pane layout** (file list / Markdown / HTML preview).
  - On small viewports (≤ `960px`) it becomes a **2-row layout** (Markdown + preview) and the file list becomes a **toggleable overlay**.

Everything you read and edit is stored as normal `*.md` files in this directory (and its subdirectories).

## Why this exists

- **Your thoughts stay yours**: notes live on your disk as `*.md` files, so they’re quick to load and easy to back up.
- **Your workflow is yours**: the whole UI is just `*.php`, `*.js`, and `*.css` — straightforward to tweak and extend.
- **Your knowledge should last**: open formats, simple folder structures, and no database lock-in.
- **Make it look like you**: customize the reading/editor typography by editing `markdown.css` and `htmlpreview.css` (and the overall app chrome in `ui.css`).

Use cases: personal notes, journaling, a lightweight knowledge base, project notes, or a small internal wiki.

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

- PHP **8.0+** (uses `str_starts_with` / `str_ends_with`).
- A web server that can run PHP (Apache/Nginx + PHP-FPM), or PHP’s built-in dev server.
- Filesystem permissions that allow the PHP process to **read/write** your `.md` files (for editing/creating/deleting).

## Installation

### Option A: PHP built-in server (quick local use)

From the project directory:

```bash
php -S 127.0.0.1:8000
```

Then open:

- `http://127.0.0.1:8000/index.php`

Notes:
- This is intended for local/dev usage. For sharing on a network, prefer a real web server + proper access controls.

### Option B: Apache or Nginx (typical self-hosting)

1. Put the project in a web-accessible directory (or point a vhost to it).
2. Ensure PHP is enabled (mod_php or PHP-FPM).
3. Visit `index.php` in your browser.

Permissions checklist (common gotcha):
- The user your web server runs as (e.g. `www-data`, `apache`, `nginx`) must be able to:
  - read all `*.md` files you want to view
  - write files you want to edit
  - create new `*.md` files
  - delete `*.md` files (from the UI)

## How it works

### Viewer (`index.php`)

`index.php` has three “modes”:

- **Overview mode** (no `file` parameter):
  - Lists notes in the repo root and in subfolders.
  - Supports filtering.
  - Shows optional “Shortcuts” from `links.csv`.
  - Allows creating a new note (`+MD`) and deleting notes.
- **View mode** (`index.php?file=path/to/note.md`):
  - Renders the selected markdown file to HTML (server-side).
  - Provides an “Edit” button that opens the editor for that file.
- **Secret prompt mode**:
  - If the requested file is listed in `secret_mds.txt` and you are not authenticated, a password prompt is shown.
  - After entering the password, the session is marked as unlocked (`$_SESSION['secret_ok']`).

Supported URL parameters:
- `file`: relative path to a `.md` file, e.g. `finance/25-12-12-Note.md`
- `folder`: filter overview to a folder name or `root`
- `q`: initial filter query (pre-fills filter input)
- `focus`: used by keyboard navigation to focus a specific item in overview
- `new=1`: opens the “New markdown” panel on page load

Also supported:
- “Shorthand” URLs without `file=`, e.g. `index.php?finance/25-12-12-Note.md`

Creating a note:
- The folder must already exist (the UI does not create directories).
- Filenames must end in `.md`.
- If content is empty, a default `# Title` is generated from the filename.

Deleting a note:
- Deletes the file from disk (`unlink`).
- A JS confirmation dialog is shown.
- Protected by a CSRF token stored in the session.

### Editor (`edit.php`)

`edit.php` is a 3-pane editor on desktop:

1. **Left pane**: note list + filter
2. **Middle pane**: markdown textarea editor (with line numbers)
3. **Right pane**: rendered HTML preview

Responsive behavior (CSS in `ui.css`):
- Under `960px`:
  - The editor becomes a 2-row layout (Markdown on top, preview below).
  - The file list is hidden by default and can be opened as an overlay via the “list” button.
  - Column resizers are hidden.

Live preview:
- Client sends the current textarea content to `edit.php?file=...&preview=1` via `POST`.
- Server renders HTML and returns it; the page replaces the preview content.

SPA-like navigation:
- Clicking a note in the left pane does not reload the full page.
- The client fetches `edit.php?file=...&json=1`, which returns:
  - raw markdown content
  - rendered HTML
  - title extracted from the markdown
- The editor updates the UI and uses `history.pushState(...)` to update the URL.

Save behavior:
- Saves to a `*.tmp` file first and then renames it over the original file.

Secret notes:
- If a file is listed in `secret_mds.txt` and the session is not unlocked, the editor redirects back to `index.php` for the password prompt.

### Markdown rendering

Rendering is implemented in PHP (a small custom parser) and is used by both `index.php` and `edit.php`.

It supports a practical subset:
- Headings (`#` through `######`)
- Paragraphs
- Inline code (`` `code` ``)
- Bold / italic (`**bold**`, `*italic*`)
- Links (`[label](https://example.com)`)
- Fenced code blocks (```), with optional language token
- Blockquotes (`>`)
- Horizontal rules
- GFM-ish tables
- Nested lists via indentation (basic)

If you rely on features outside this subset (e.g. images), you’ll likely want to extend the parser or swap it for a library.

## Configuration

### Secret notes

`secret_mds.txt` is a newline-separated list of **relative markdown paths** to protect:

```text
finance/private.md
research/25-01-01-secret-note.md
```

Password:
- The password is currently set in code as `$SECRET_MDS_PASSWORD` in both `index.php` and `edit.php`.
- If you change it, change it in **both** files so the viewer/editor stay in sync.

Important: “secret” is only a lightweight UI/session gate; it does not encrypt files.

### Shortcuts (`links.csv`)

If `links.csv` exists, it is shown as a “Shortcuts” section.

The parser expects a header row and at least two columns:

```csv
shortcut,url
DuckDuckGo Search,https://duckduckgo.com/
PHP Docs,https://www.php.net/
Github,https://www.github.com/
Markdown tutorial on Youtube,https://www.youtube.com/watch?v=_PPWWRV6gbA
```

## Security notes (read before exposing)

This project is designed for personal/self-hosted use and intentionally stays simple.

- There is no user management, no per-note ACL, and no encryption.
- The “secret notes” feature is a session flag + a hardcoded password.
- Do not expose this directly to the public internet. Prefer:
  - running it only on localhost
  - restricting access to your LAN/VPN
  - putting it behind HTTP auth / SSO / reverse-proxy authentication

## Troubleshooting

- “Cannot create/delete/save”: fix filesystem permissions for the PHP/webserver user.
- “Secret note is locked”: open the file in `index.php` first and enter the password.
- Filenames rejected: only paths containing `A-Za-z0-9._-` and unicode letters/numbers are accepted; spaces are not allowed; must end in `.md`.
- Math not rendering: MathJax is loaded from a CDN; offline networks will block it unless you host it locally.
>>>>>>> de7efcc (Sync local project)
