# MarkdownManager v0.5.1

![MarkdownManager screenshot](markdownmanager.png)

MarkdownManager is a fast, flat-file Markdown editor you can host yourself. No database. No lock-in. Just a clean web UI for plain text notes that live as `.md` files on disk.

Use it as a simple notebook, or flip on Website Publication Mode (WPM) to run a lightweight CMS workflow with publish states, metadata, and HTML export.

New in v0.5.1: richer static exports (foldered index, Mermaid support, repo footer) and a smoother Pages workflow.

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

**How it works (end to end)**

1) A GitHub Actions workflow runs on `main` pushes (or manually).
2) The workflow calls `php tools/export-wet-html.php --out dist`.
3) The exporter renders each `.md` to wet HTML using the same PHP renderer as the app preview.
4) The workflow uploads the `dist/` folder as a Pages artifact.
5) `actions/deploy-pages` publishes the artifact to GitHub Pages.

**Repo setup (required)**

1) In **Settings → Pages**, set **Source = GitHub Actions**.
2) Add the workflow at `.github/workflows/pages.yml` (this repo includes a ready-to-use file).

**Workflow used by this plugin**

```yaml
name: Export wet HTML and deploy to GitHub Pages

on:
  push:
    branches: ["main"]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: shivammathur/setup-php@v2
        with:
          php-version: "8.2"
      - name: Export static HTML
        env:
          MDM_EXPORT_SRC: example-notes
          MDM_EXPORT_DIR: dist
          MDM_EXPORT_BASE: /MarkdownManager/
        run: |
          php tools/export-wet-html.php --out "${MDM_EXPORT_DIR}" --src "${MDM_EXPORT_SRC}" --base "${MDM_EXPORT_BASE}"
          touch "${MDM_EXPORT_DIR}/.nojekyll"
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

Note: `.env` is loaded by `env_loader.php` for local use. The GitHub Pages workflow passes its settings directly via environment variables (no `.env` file in CI). For local testing, copy `.env.example` to `.env` and set `MDM_EXPORT_SRC=example-notes`, `MDM_EXPORT_DIR=dist`, and `MDM_EXPORT_BASE=/MarkdownManager/`.

**Why these workflow permissions**

- `contents: read` lets Actions check out the repository.
- `pages: write` and `id-token: write` are required by `actions/deploy-pages`.

**What the exporter actually generates**

- One `.html` file per `.md`, preserving the folder structure (relative to `--src`).
- A root `index.html` that lists all exported pages.
- Markdown links that point to other exported `.md` files are rewritten to `.html`.
- Inline wet CSS that matches the app's HTML preview:
  - `static/htmlpreview.css`
  - Theme preset `<theme>_htmlpreview.css` when selected
  - Theme overrides + custom CSS from `metadata_config.json`
- The `images/` folder is copied into the output so image tokens (`{{ }}`) keep working.
- Notes listed in `secret_mds.txt` are skipped automatically.

**Recommended export flags (this repo)**

- `--out dist` (required): output folder for the static site.
- `--src example-notes` (optional): export only the example notes folder.
- `--only-published` (optional): when WPM is enabled, export only `publishstate: Published`.

You can also set these in `.env`:

```
MDM_EXPORT_DIR=dist
MDM_EXPORT_SRC=example-notes
MDM_EXPORT_PUBLISHED_ONLY=1
MDM_EXPORT_REPO_URL=https://github.com/YourUser/YourRepo
MDM_EXPORT_REPO_LABEL=Source on GitHub
```

**Base path gotcha (Project Pages)**

Project Pages deploy to:

```
https://<user>.github.io/<repo>/
```

If your exported HTML uses root-relative links like `/css/app.css`, those will break. The exporter keeps links relative, but it is still a good idea to set a base path in the workflow for this repo:

```
MDM_EXPORT_BASE=/MarkdownManager/
```

Or pass it directly:

```
php tools/export-wet-html.php --out dist --base /MarkdownManager/
```

**Local preview tip**

If you run `php -S 127.0.0.1:1234` from the repo root and open `/dist/index.html`, set `MDM_EXPORT_BASE=/dist/` in your local `.env` so assets and links resolve under `/dist/`. If you instead serve `dist/` as the web root (e.g. `php -S 127.0.0.1:1234 -t dist`), you can leave `MDM_EXPORT_BASE` empty.

This inserts `<base href="/YourRepoName/">` into every exported page so assets and links resolve correctly.

**No PAT, no push**

You do not need to store a personal access token or push generated HTML into your repo. The workflow deploys a build artifact using the built-in `GITHUB_TOKEN` and Pages permissions.

### Google site search plugin (`google_search`)

WPM-only plugin that adds a site-scoped Google search box for your public domain (`WPM_BASE_URL`).

## Extras

- **links.csv**: shows a "Shortcuts" list (CSV with `shortcut,url`).

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
