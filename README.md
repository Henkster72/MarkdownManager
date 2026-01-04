# MarkdownManager v0.4.2

![MarkdownManager screenshot](markdownmanager.png)

MarkdownManager is a fast, flat-file Markdown editor you can host yourself. No database. No lock-in. Just a clean web UI for plain text notes that live as `.md` files on disk.

Use it as a simple notebook, or flip on Website Publication Mode (WPM) to run a lightweight CMS workflow with publish states, metadata, and HTML export.

## Why check this out

- Flat files only: your notes are readable outside the app and easy to back up.
- Instant live preview: Markdown updates on save, with clean HTML output.
- WPM mode: publish states, badges, author/subtitle rules, and metadata control.
- CMS-ready: export HTML directly or pair with AW-SSG for a full site workflow.
- No build chain: drop it on a PHP host and go.

## Quick start (local)

1. Clone this repo.
2. Copy `.env.example` to `.env`.
3. Optional: remove `example-notes/` once you are comfortable.
4. Run a local PHP server:

```bash
php -S localhost:1234
```

Open `http://localhost:1234/index.php` in your browser.

## Everyday use

- Click `+MD` to create a note.
- Use the left explorer to filter and open notes.
- Save and preview in the editor.
- Copy or export HTML when needed.

## Use it as a CMS

MarkdownManager can act as a lightweight CMS in two ways:

1) **Export to HTML**  
Use the built-in HTML copy/download tools for clean output.

2) **Pair with AW-SSG**  
Write content in MarkdownManager, then let AW-SSG build a full static site. This gives you a proper CMS pipeline without leaving Markdown.

Enable Website Publication Mode (WPM) in Settings to unlock publish states, metadata, and workflow rules.

## Features at a glance

- Live Markdown editor with HTML preview.
- HTML export: dry, medium, and wet modes.
- Theme overrides + custom CSS stored in settings.
- Image manager with upload and insert.
- Link modal with internal/external/footnote helpers.
- Multi-language UI (EN/NL/DE/FR/PT/ES/IT).
- Works on desktop and mobile.

## Security warning (read this)

MarkdownManager is not safe to expose to the public internet. It has no accounts, no MFA, no rate limiting, and only lightweight protection for "secret" notes. WPM mode adds workflow safeguards, but it does not make the app safe for public exposure. Run it on localhost or a trusted private network only.

## Configuration

Edit `.env` to tune paths and features:

- `PLUGINS_DIR`, `STATIC_DIR`, `IMAGES_DIR`, `THEMES_DIR`, `TRANSLATIONS_DIR`
- `METADATA_CONFIG_FILE`, `METADATA_PUBLISHER_CONFIG_FILE`
- `WPM_BASE_URL` (for public link + search plugin)
- `SECRET_MDS_FILE`, `SECRET_MDS_PASSWORD`

## Website publication mode (WPM)

WPM is built for teams or individuals who want a publishing workflow:

- Requires metadata at the top of each note.
- Adds publish states: Concept, Processing, Published.
- Shows state badges in the explorer.
- Enforces author/subtitle rules (configurable).

Example metadata block:

```text
{page_title: Example page title}
{page_subtitle: Optional subtitle}
{post_date: 2025-11-23}
{published_date: 2025-11-30}
{publishstate: Published}
{author: Jane Doe}
```

Notes:
- `{key: value}` is the canonical metadata format.
- `published_date` overrides `post_date` when present.
- WPM settings are stored in `metadata_config.json`.

## HTML export modes

- **Dry**: clean HTML, no classes or styles.
- **Medium**: class names only.
- **Wet**: includes CSS (theme + custom overrides).

Semidry/Wet exports only keep classes that you explicitly add via `{: class="..."}` in Markdown.

## Extras

- **links.csv**: shows a "Shortcuts" list (CSV with `shortcut,url`).
- **Google site search plugin** (WPM): add a site search box for your public domain.

## Troubleshooting

- "Cannot create/delete/save": fix filesystem permissions for the PHP/webserver user.
- "Secret note is locked": open the file in `index.php` first and enter the password.
- Filenames rejected: only `A-Za-z0-9._-` and unicode letters/numbers are allowed; must end in `.md`.
- Math not rendering: MathJax is loaded from a CDN; offline networks will block it unless you host it locally.

## What's new in 0.4.2

- Spanish and Italian UI translations added.
- Tutorials refreshed with operations + shortcuts, plus ES/IT versions.

## What's new in 0.4.1

- WPM publish-state logic is now coherent (save -> Concept, badges and buttons sync).
- Publish state changes update metadata immediately and auto-set `published_date`.
- `creationdate` and `changedate` are available in metadata settings; `changedate` updates on save.
- Theme overrides + custom CSS persist in `metadata_config.json`.
- Export pipeline cleaned up: CSS injected once, preview-only selectors stripped.
- Semidry/wet export keeps only classes from `{: class="..."}`.
- HTML export/copy is superuser-only.
- Mobile resizer added for Markdown/preview split.
- Editor toolbar redesigned with formatting controls and better mobile behavior.

## What's new in 0.4

- Explorer drag-and-drop for notes + folders.
- In-place folder rename and improved tree view.
- Example notes moved under `example-notes/`.
- Friendlier image manager errors and clearer `IMAGES_DIR` guidance.

## What's new in 0.3.3

- Stronger path sanitization and security hardening.
- `{TOC}` hot keyword for automatic table of contents.
- HTML preview improvements for inline HTML and metadata handling.
- Folder rules in WPM: no nested folders, no emoji folder names.

## Changelog (short)

See `CHANGELOG.md` for full details.

- 0.4.3: Editor UX polish (custom CSS inserts, redo formatting shortcut, heading preview, overrides badge).
- 0.4.2: Spanish/Italian translations, tutorial updates and new ES/IT tutorials.
- 0.4.1: WPM workflow fixes, export cleanup, custom CSS persistence, toolbar overhaul.
- 0.4: Explorer DnD, folder UX polish, image manager reliability.
- 0.3.3: Security hardening, {TOC}, HTML preview upgrades, WPM folder rules.
- 0.3: Website publication mode + metadata-driven publish states.
- 0.2: Plugins, image manager, HTML export, folder UX improvements.
- 0.1.0: Initial public release.
