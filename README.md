# MarkdownManager v0.6

![MarkdownManager screenshot](markdownmanager.png)

MarkdownManager is a fast, flat-file Markdown editor you can host yourself. No database. No lock-in. Just a clean web UI for plain text notes that live as `.md` files on disk.

Use it as a simple notebook, or flip on Website Publication Mode (WPM) to run a lightweight CMS workflow with publish states, metadata, and HTML export.

Recent updates:
- v0.6: TOC sidebar option, wet export font links, safer auth hashes, and mobile pane focus fixes.
- v0.5.1: richer static exports (foldered index, Mermaid support, repo footer) and a smoother Pages workflow.
- v0.5: GitHub Pages export plugin plus a CLI wet HTML exporter.
- v0.4.3: formatting shortcuts, theme override badges, and export class discipline.
- v0.4.2: Spanish/Italian UI and refreshed tutorials.

## Why check this out

- Flat files only: your notes are readable outside the app and easy to back up.
- Instant live preview: Markdown updates on save, with clean HTML output.
- WPM mode: publish states, badges, author/subtitle rules, and metadata control.
- CMS-ready: export HTML directly or pair with AW-SSG for a structured full-site workflow.
- No build chain: drop it on a PHP host and go.
- Writing-first UX: open, edit, and publish without leaving your notes.

## Short comparison: Jekyll, Astro, and other SSGs

- Jekyll: great for static sites and GitHub Pages, but no live editor or content workflow. MarkdownManager is the authoring UI.
- Astro: powerful for component-driven sites, but requires a build pipeline. MarkdownManager is light and runs anywhere PHP runs.
- Hugo / Eleventy / Next.js: fast and flexible, but still build-focused. MarkdownManager stays in edit mode and can export to them.
- AW-SSG: use MarkdownManager to edit and export wet HTML, then let AW-SSG handle structure, navigation, and the final static site.

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
 
Export-related settings use the `MDM_` prefix (short for MarkdownManager).

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

## Plugins

MarkdownManager ships with a small plugin system. Plugins live in `plugins/` and are auto-loaded. Most plugins add explorer sections or header widgets, but they can also provide automation tooling.

### GitHub Pages export plugin (`github_pages_export`)

This plugin is a build-time integration that turns your MarkdownManager notes into a static site and deploys it to GitHub Pages. There is no "auth plugin" needed. GitHub Actions already provides `GITHUB_TOKEN` when the workflow runs, and the deployment step uses the Pages OIDC permissions.
Plugin file: `plugins/github_pages_export_plugin.php`.

**Tutorials**

Playful step-by-step guides live in `example-notes/tutorials/`:
- `example-notes/tutorials/github_pages_tutorial_en.md`
- `example-notes/tutorials/github_pages_tutorial_nl.md`
- `example-notes/tutorials/github_pages_tutorial_de.md`
- `example-notes/tutorials/github_pages_tutorial_fr.md`
- `example-notes/tutorials/github_pages_tutorial_es.md`
- `example-notes/tutorials/github_pages_tutorial_it.md`
- `example-notes/tutorials/github_pages_tutorial_pt.md`

Think of it as: write notes -> push -> GitHub Pages does the rest. No manual HTML dumps, just a clean deploy that updates itself when you push.

If you want the full step-by-step (with screenshots-style clarity), open one of the tutorials above. They are short, friendly, and actually fun to follow.

### Google site search plugin (`google_search`)

WPM-only plugin that adds a site-scoped Google search box for your public domain (`WPM_BASE_URL`).

## Extras

- **links.csv**: shows a "Shortcuts" list (CSV with `shortcut,url`).

## Troubleshooting

- "Cannot create/delete/save": fix filesystem permissions for the PHP/webserver user.
- "Secret note is locked": open the file in `index.php` first and enter the password.
- Filenames rejected: only `A-Za-z0-9._-` and unicode letters/numbers are allowed; must end in `.md`.
- Math not rendering: MathJax is loaded from a CDN; offline networks will block it unless you host it locally.

## Changelog (short)

See `CHANGELOG.md` for full details.

- 0.6.2: JS refactor into `mdm.*` modules with shared helpers and core bootstrap.
- 0.6: TOC sidebar option, wet export font links, safer auth hashes, and mobile pane focus fixes.
- 0.5.1: Foldered export index, Mermaid in exports, optional repo footer, and Pages workflow polish.
- 0.5: GitHub Pages export plugin + CLI wet HTML exporter, settings checks, UI upgrades.
- 0.4.3: Custom CSS inserts, HTML tab expansion, repeat format shortcut, heading previews.
- 0.4.2: Spanish/Italian UI, refreshed tutorials, new ES/IT tutorial notes.
- 0.4.1: WPM state sync, metadata date options, export cleanup, toolbar overhaul.
- 0.4: Explorer drag/drop + folder rename, example notes move, image manager improvements.
- 0.3.3: Security hardening, {TOC}, HTML preview upgrades, WPM folder rules.
- 0.3.2: WPM Google site search + public header link, translated UI strings.
- 0.3.1.2: Settings cleanup, copy workflow upgrades, HTML preview polish, import/export.
- 0.3.1: More translations + tutorials, HTML preview improvements, AJAX save + replace.
- 0.3: WPM mode, sorting options, settings tweaks, mobile layout polish.
- 0.2: Plugins, image manager, HTML export, folder UX improvements.
- 0.1.0: Initial public release.
