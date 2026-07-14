# Changelog

## 0.94

- Visual link editing: fragment links such as `#section` are treated as internal links in the link modal and keep their fragment when updated.
- Editor toolbar: the custom section/snippet dropdown is now labeled as custom sections instead of custom CSS, and imported CSS rules are scanned for section classes too.
- WPM visual preview: Jinja-style preview variables are resolved from metadata/`set` values or hidden from the editor preview so authors in hide-Markdown mode do not see raw template syntax.
- Instance styling: target instances can load generated or purged site CSS through the existing custom section CSS import path; instance settings remain the source of truth.

## 0.93

- WPM explorer sorting: default date sorting now uses `post_date`, then `creationdate`, then the filename date, with newest articles first in each folder across index, edit, lazy explorer payloads, and basic view.
- WPM date parsing: explorer dates now handle numeric dates plus common Dutch/English display formats such as `14 juli 2026`, `16 December 2025`, and `Nov 20, 2025`.
- WPM publish-state ordering: default date sort no longer lets publish-state grouping push older Concept/Processing items above newer articles.
- Image modal: the Markdown insertion tip is hidden when the hide-Markdown visual editor option is enabled.
- Article metadata modal: the slug is no longer shown as an editable field; it appears in small text next to the modal title.
- Article metadata images: `page_picture` now has an inline image picker fed by the existing image manager, inserting plain image filenames such as `cover.webp`.
- Documentation/translations: README, short changelog copy, and README translation notes were refreshed for version 0.93.

## 0.92

- WPM public links: public-page URLs now use clean trailing-slash paths, stay hidden until the note is Published, and update correctly during SPA note loads and publish-state changes.
- Section snippets/includes: added optional `sections/section_*.html` snippets for the editor insert menu and expanded matching Jinja-style `{% include %}` templates in preview, with basic variable substitution from metadata and `{% set %}` values.
- Visual link editing: clicking links in visual editor mode now opens the link modal for editing, preserving existing link attributes where possible and syncing the edited link back to Markdown.
- Article metadata modal: refreshed the main article fields with friendlier labels, preferred field ordering, slug display, default author fallback, and default post-date filling.
- Markdown attributes/export: attribute-list parsing now supports `id` alongside `class` and `style`, including merge behavior during preview rendering.
- WPM metadata fields: publisher metadata config now preserves additional configured fields instead of dropping unknown keys.
- Asset/script safety: JSON bootstrapping is escaped for inline scripts and static CSS/JS assets now receive file-mtime cache busters in the index view.
- Explorer/cache polish: metadata and lazy explorer cache versions were bumped for the changed metadata parsing, and folder/header visual spacing was tightened.
- Authentication setup: the auth modal now refreshes backend auth status on load and handles an already-configured setup response by returning to login.
- Translations: English and Dutch labels were refreshed for article metadata and link editing.

## 0.91

- TOC layout stability: fixed the right-side TOC preview layout so the TOC rail and article body stay in the same two-column grid row instead of slipping above or below the title/content block.
- TOC editor behavior: the generated TOC shell is now non-editable in visual/WPM mode, while the article body remains editable as before.
- TOC sticky behavior: restored the in-editor sticky TOC behavior with a local low offset so the menu stays visible while scrolling the article preview without drifting over the title block.
- TOC marker anchoring: tightened `{TOC}` anchoring so server-rendered and client-updated previews keep the TOC mounted at the placeholder position during toggles and refreshes.
- Regression coverage: added a TOC layout regression test that checks the rendered two-column structure and the critical CSS rules that keep the TOC row-locked and sticky in editor preview mode.

## 0.9

- WPM visual editing: added a hide-markdown editor mode that lets authors work in the preview surface while keeping the Markdown textarea available as an underwater/source mode.
- Editor toolbar: added a source toggle (`pi-code` / `pi-eye`), a WPM article metadata button (`pi-gear`), and an optional TOC toolbar button controlled from superuser settings.
- Article metadata: added a modal editor for Markdown-visible WPM/frontmatter fields so regular users can edit allowed key/value metadata without touching hidden fields.
- TOC workflow: `{TOC}` is now toggled near the frontmatter/metafields instead of at the cursor, accepts spaced `{ TOC }`, and warns in EN/NL when no H3 (`###`) headings exist.
- Hide-markdown responsive UX: fixed preview width on narrow viewports, balanced toolbar buttons across the available width, hides button text at tablet/mobile widths, and omits the `.md` extension in the new-article UI.
- WPM/settings copy: removed the obsolete secret-notes wording from WPM hints, updated the slug lock text, and added settings persistence for hide-markdown and TOC toolbar options.
- Visual editor commands: wired toolbar/link/image/format actions through the visual editor mode so they affect the active editing surface instead of only the hidden Markdown textarea.
- Authentication/test config: updated local test hashes so the normal user password can differ from the superuser password.
- Translations: refreshed English and Dutch labels for the new editor, metadata, TOC, hide-markdown, and WPM setting controls.

## 0.81

- Explorer performance (large libraries): added lazy explorer tree loading with JSON note payloads, client-side cache/TTL reuse, and reduced initial index payload pressure for very large note sets.
- Transfer-size reduction: enabled gzip response buffering in bootstrap when supported to shrink first-load page transfer.
- Metadata/title extraction speedups: added explorer metadata cache persistence to avoid repeatedly re-reading unchanged markdown files.
- Index layout controls: introduced configurable dual-pane overview mode for `index.php` (with settings persistence and runtime toggle support).
- Split layout persistence: added dedicated split storage keys, normalized/validated restored widths, and introduced `static/mdm.splitter.js` handling for index/edit split states.
- Index shortcuts panel UX: added a draggable vertical resizer with per-device defaults, saved height, and adaptive scaling/title-collapse behavior.
- Explorer control consistency: moved and unified top explorer actions across edit/index (new note/folder + edit/rename/delete), and consolidated shared rendering in `explorer_view.php`.
- Sticky explorer controls: added a shared sticky control stack so sort + filter controls remain visible while scrolling notes in split/edit overview panes.
- Keyboard/focus and SPA fixes: improved arrow-key tree navigation, folder open/close behavior, focus retention across SPA note loads, and fixed regression errors (`focusParam` / `scrollFocus`-related runtime issues).
- Rename modal targeting: rename now follows the currently focused explorer markdown (not stale state), updates hidden target file reliably, and syncs label/placeholder text by mode.
- Rename semantics cleanup: switched rename field naming to neutral `new_name` (with backward-compatible `new_slug` fallback), and clarified non-WPM behavior as filename-based.
- Non-WPM date-prefix control: added a default-on “keep date prefix” checkbox in rename modal (hidden in WPM), allowing optional removal of `yy-mm-dd-` from filenames.
- Explorer/filter UX cleanup: removed redundant edit hint text and standardized filter row placement under toolbar controls in shared explorer layouts.
- Explorer root behavior: the `Root` section no longer auto-opens on every page load; it now opens only when `folder=root` is selected or when the current file is in root, reducing noisy explorer resets while navigating.
- Explorer visual scanability: added deterministic per-folder accent coloring (path-hash based) with colored folder controls, subtle section background/border accents, and stronger emphasis for emoji-labeled folders.
- Folder accent rendering fix: moved section accent CSS variable defaults to the folder section scope so runtime JS-assigned accents are actually inherited and visible.
- Folder emoji compatibility: expanded folder/path sanitization to accept modern emoji composition patterns (including variation selectors, emoji ranges, combining marks/modifiers, and ZWJ), fixing inconsistent cases where some emoji worked and others were rejected.
- WPM/normal-mode folder creation guardrails: added a safe JS emoji detector fallback used by folder creation checks, preventing undefined-regex edge errors.
- Explorer interactions: preserved existing drag/drop and folder action behavior while improving visual affordances for folder headers and icon states.
- Settings modal IA refresh: reorganized settings into clearer collapsible groups, including a dedicated **HTML preview settings** section (copy/html mode/class prefix/TOC/post date controls) and a dedicated **Theme settings** section.
- Theme settings simplification: removed the nested collapsible under Theme settings so “Theme adjustments (optional)” is immediately visible when opening the parent Theme section.
- Collapsible affordance refresh: replaced default `<summary>` markers with Popicon `pi-leftcaret` indicators and animated rotation for open/close state so section toggles are visually consistent across settings panels.
- UI consistency updates: aligned both `index.php` and `edit.php` settings modals to the same section structure, control grouping, and caret behavior.

## 0.8

- AW-SSG integration: added optional `aw_ssg_template_export` plugin (`plugins/aw_ssg_template_export_plugin.php`) so instances without the plugin continue to work unchanged.
- Editor export UI: added `Template download` next to HTML download (same `pi-download` icon) for Jinja-ready exports.
- Export endpoint: `edit.php?file=...&preview=1&template=jinja` now returns an immediate AW-SSG template export for the active markdown.
- Template structure: export now emits `{% extends "base.html" %}` by default, maps metadata to Jinja `{% set ... %}` values, and wraps body in `{% block content %}...{% endblock content %}`.
- Metadata mapping/settings: added configurable Jinja metafield prefix mapping (`page_` default, e.g. `post_`) plus support for required/obligatory metadata with default values in WPM.
- WPM defaults: obligatory metafields can be auto-injected into new notes; `active_page` is derived from the markdown folder path (root stays unset).
- Template body smart cleanup: removes duplicate H1/H2 when already covered by metadata, suppresses the metadata cover image duplicate, and converts following images/links to Jinja token form (`{{image.ext}}`, `{{subdir/page.html}}`).
- Export class behavior: fixed empty export-class-prefix handling so unwanted `md_` classes are no longer injected.
- Footnote/template cleanup: removed double numbering in footnote export and split class semantics so `fn` is inline-reference only, while the footnote section uses `fn-section`.

## 0.7

- Explorer: WPM publish badges now include state icons (lightbulb/certificate/checked certificate).
- Explorer: active note icon uses the labeled document glyph and stays in sync during SPA navigation.
- Preview: trailing `{: class="..." }` now applies to list items (`li`) as well as paragraphs.
- Preview: hidden metadata is preserved for rendering so publish state stays accurate in live preview.
- WPM author defaults: only injected for Concept notes when author is empty; published/processing no longer get a default author in preview.
- Editor toolbar: tightened sizing, icon polish, and ordered-list glyph tweaks for a cleaner, consistent layout.

## 0.6.3

- Editor: caret-adjacent bracket matching for `()`, `[]`, and `{}` with color-coded background highlights.
- Editor: overlay alignment now respects wrap mode and inherits custom editor font/size styling.
- Links: dragging a note from the explorer into the editor inserts an internal link using the link modal format.
- Links: internal link builder now targets `index.php?file=...` with a depth-aware relative prefix.
- WPM metadata: `author` can be hidden in Markdown while still visible in HTML preview (defaults updated).
- WPM metadata: author label is localized in HTML preview and falls back to the WPM default author when missing.

## 0.6.2

- JS: refactored `static/base.js` into DRY `static/mdm.*.js` modules with shared helpers and a core bootstrap.

## 0.6.1

- README: GitHub Pages section shortened and now points to tutorials; version list refreshed.
- Tutorials: added GitHub Pages export walkthroughs in EN/NL/DE/FR/ES/IT/PT under `example-notes/tutorials/`.

## 0.6

- Settings: UI language list is auto-detected from available translations (fixes missing ES/IT) with case-insensitive codes.
- TOC: new inline/left/right menu option, vertical sidebar preview, and active section highlight on scroll.
- TOC export: wet HTML preserves sidebar layout/classes, non-wet exports fall back to inline TOC.
- WPM header link now appears only for published notes and no longer depends on the Google search plugin.
- Header public link icon styling is simplified (no extra background/border).
- Index page title now includes the app name.
- Wet HTML export includes theme Google Font links.
- Mermaid: pie chart syntax normalization for stricter Mermaid versions.
- Auth: password storage upgraded to `password_hash` (Argon2id/bcrypt) with automatic SHA256 migration on login.
- Mobile: pane focus heights recalc with header show/hide; preview focus toggle uses an up-caret icon.

## 0.5.1

- Exporter index now groups notes by folder, uses Pop Icon (`pi-*`) styling, and copies the icon font to the output.
- Mermaid blocks in exported HTML now load the Mermaid CDN and render client-side.
- Optional repo footer on exported pages via `MDM_EXPORT_REPO_URL` + `MDM_EXPORT_REPO_LABEL`.
- GitHub Pages workflow now injects export settings (source folder, base path, repo link) at build time.
- README refreshed with a clearer SSG comparison and updated export tips.
- Example notes updated/curated.

## 0.5

- GitHub Pages export plugin: automated wet HTML build and Pages deployment using `GITHUB_TOKEN` with a ready-to-run Actions workflow.
- New CLI exporter (`tools/export-wet-html.php`) renders all Markdown to wet HTML, injects theme/custom CSS, rewrites internal links, generates an index page, and copies images.
- GitHub Pages export endpoint (`github_pages_export.php`) adds config checks and single-note exports with CSRF/auth validation, WPM publish gating, and link/image handling.
- UI: "GitHub Pages" export button in edit preview and index view appears only when the plugin is enabled and required env vars are set.
- Settings modal: GitHub Pages config check button with clear status and error/warning details.
- Plugin JS split: GitHub Pages client logic moved to `static/github_pages_export.js` and loaded only when the plugin is present.
- Editor UX: link modal (internal/external/footnote/YouTube) restored with toolbar buttons for link + image insertion.
- Mobile UX: pane focus toggles let you maximize Markdown or preview and restore saved split heights.
- Navigation fixes: breadcrumb links now navigate to folder and note in index view, update on SPA nav, and warn about unsaved changes.
- Documentation: README plugin docs and `.env.example` expanded with GitHub Pages export settings.

## 0.4.3

- Custom CSS quick insert: a toolbar dropdown appears when custom CSS exists and inserts selector-based snippets (single-class selectors use `{: class="..." }`).
- HTML shorthand expansion: typing `p` or `div.class` and pressing Tab inserts matching tags with the cursor inside.
- Repeat last formatting: new Mod+R / Ctrl+Alt+R shortcut applies the most recent formatting action to the current selection.
- Heading selector starts at H1 and shows H1–H6 preview sizing.
- Theme overrides now show a visible save badge, including errors.
- Explorer collapse hides rename/delete actions.

## 0.4.2

- Spanish and Italian UI translations added.
- Tutorials refreshed with operations + shortcuts, plus ES/IT versions.

## README archive (moved from README v0.4.1)

# MarkdownManager v0.4.1

![MarkdownManager screenshot](markdownmanager.png)

MarkdownManager is a small, fast app that turns a folder of plain text notes into a clean, searchable notebook you host yourself. No database. Flat-file MD notes. No lock-in. Just your files, readable and editable in a friendly web interface.

Sharpen your thinking.

New and exciting: thanks to user input, Mermaid diagram support is now built in. It is still rare to see Mermaid in a lightweight PHP notes app, so this feels like a big win for visual thinkers.

## Security warning (read this)

MarkdownManager is not safe to expose to the public internet. It has no accounts, no MFA, no rate limiting, and only lightweight protection for "secret" notes. WPM mode adds some workflow safeguards (required author, required subtitle, publish states, and stricter metadata rules), but it does not make the app safe for public exposure. If you put this on a public server without a strong access layer (VPN, reverse proxy auth, IP allowlist), you are asking for trouble. Run it on localhost or a trusted private network only.

## What's new in 0.4.1

- Publishing workflow coherence: saving a changed note forces `publishstate` back to Concept, updates the badge, and re-enables the Publish button; processing/published stay disabled until state changes.
- Superuser guardrails: `publishStateSelect` always remains superuser-only; normal users can only press Publish when enabled.
- Publish state sync: changing publish state updates the metadata immediately, updates the note badge instantly, and triggers `published_date` when switching to Published.
- Date fields normalized: `creationdate` and `changedate` are now selectable in metadata settings; `changedate` updates on save in WPM; `published_date` is auto-set on Published transitions.
- Theme overrides are stored in JSON: preview theme overrides + custom CSS are persisted in `metadata_config.json` (no longer transient).
- Custom CSS input: new field in Settings; CSS is applied to the live preview and exported with wet/semidry HTML.
- Export hygiene: wet export injects CSS once at the top, not inline-per-node; semidry export includes custom CSS and class selectors.
- Class discipline: semidry/wet export only keep classes explicitly declared via `{: class="..."}` in Markdown; default `md-*` classes are stripped.
- CSS sanitization: export CSS removes `.preview-content` prefixes and ignores selectors that only apply to preview-only classes.
- HTML export access: HTML copy/download buttons are hidden for non-superusers.
- Mobile split-resizer: the Markdown/preview split is now touch-resizable on mobile, stored in localStorage, and defaults to 50/50 height.
- Mobile header stability: header show/hide is suppressed during resize to avoid layout jumps.
- Markdown toolbar overhaul: new formatting toolbar (Save -> Heading select -> B/I/U -> align -> quote -> lists -> table -> Revert), icon-first, no labels on narrow panes.
- Alignment helpers: Align button inserts `{ : class="left|center|right" }` and preview honors these classes.
- Table button icon: replaced the "T" with a 2x2 grid icon for clarity.
- Explorer actions: rename/delete moved above the explorer; delete is superuser-only and hidden for normal users; rename is hidden for normal users.
- Translations updated: publish badges and new UI strings are localized across EN/NL/DE/FR/PT.

## What's new in 0.4

- Explorer drag-and-drop: move markdown notes between folders (superuser-only) with mouse or touch.
- Folder UX polish: in-place rename, drag-and-drop folder reordering, and a cleaner tree view with folder/file icons.
- Focused folder view now includes subfolders so nested notes stay visible when filtering.
- Example content now lives under `example-notes/` (safe to delete after install).
- Image manager reliability: localized, friendlier error messages plus clearer `IMAGES_DIR` guidance (and better permission handling on upload).

## What's new in 0.3.3

- Security hardening: stronger path sanitization (directory traversal protection) for file and folder operations, plus a formal `SECURITY.md` disclosure policy.
- Metadata cleanup: `{key: value}` is the canonical hidden meta delimiter, legacy `_key: value_` is normalized on save, and `tools/convert_meta_delimiter.py` can migrate existing notes.
- WPM metadata bugfix: normal mode no longer injects WPM-only fields; WPM keeps its stricter metadata rules.
- Table of contents hot keyword: `{TOC}` generates an in-place H3 table of contents with stable IDs (handles existing `<h3 id="...">` blocks and avoids duplicates).
- HTML preview improvements: inline HTML blocks in Markdown now render correctly in the preview, with safer handling.
- Error handling + offline awareness: friendly error modal for failed requests, smarter offline indicator with configurable delay, and automatic reset after successful saves/loads.
- Folder structure upgrades: explorer supports two-level folders; nested folder creation is disabled in WPM, emoji folder names are allowed in normal mode, and enabling WPM sanitizes emoji and flattens subfolders with a clear warning.
- Folder management: superusers can rename and delete folders (including all notes inside) directly from the explorer; normal users cannot.

## What's new in 0.3.2

- Google site search plugin (WPM): optional search box that scopes queries to `WPM_BASE_URL`.
- Public page link in the header (WPM): shows a pi-externallink next to the app title for the current note.
- WPM search UI strings are translated (EN/NL/FR/DE/PT).

## What's new in 0.3.1.2

- Settings modal cleanup: UI settings grouped under a collapsible section, theme label clarified, import/export in two columns on large screens, and no background blur.
- Copy workflow upgrades: preview copy buttons + per-code-block copy buttons with checkmark feedback, HTML copy modes (dry/medium/wet), and metadata include toggle.
- HTML preview polish: post date formatting + alignment options with translations, and clearer separation between preview rendering and export/copy output.
- Settings portability: JSON import/export (excluding author) including metadata/fields and theme settings.

## What's new in 0.3.1.1

- WPM bugfixes: title-first MD creation with slug validation, date prefix optional by default in WPM, and superuser-only filename/slug changes.

## What's new in 0.3.1

- Major translation effort: added DE/FR/PT UI strings and localized tutorials, plus a first-run tutorial that opens per language in WPM mode.
- HTML preview improvements: caret footnotes, inline HTML support, strikethrough, button styling, and more robust link/class parsing.
- Editor UX upgrades: AJAX save without refresh, visible save status, replace modal, and better error diagnostics.
- Theme refinements: complementary secondary accent for better contrast and updated preview spacing.

## What's new in 0.3

- Website publication mode for turning Markdown into a publish-ready content flow with metadata, publish states, and strict author/subtitle rules.
- Explorer sorting by date, title, or filename (with the date shown next to the slug).
- Settings upgrades for superusers: app title override and editor view toggles moved into Settings to free toolbar space.
- Mobile and layout refinements for the explorer overlay and header.

## Changelog

See `CHANGELOG.md`.

## Website publication mode (WPM)

Website publication mode is meant for teams or individuals who want to treat Markdown as a lightweight CMS. It adds structured metadata, publishing states, and stricter content rules while keeping the same flat-file workflow. This can be coupled to AW-SSG if needed to get a seemless website publication tool.

### How it works

When enabled, MarkdownManager expects a hidden metadata block at the top of each note. The metadata is stored as special lines that are not rendered in Markdown preview or HTML output.

Example (hidden metadata block):

```

{page_title: Example page title}
{page_subtitle: Optional subtitle}
{post_date: 2025-11-23}
{published_date: 2025-11-30}
{publishstate: Published}
{author: Jane Doe}
```

Notes:

- Each metadata line uses the format `{key: value}`. Legacy `_key: value_` is still accepted and will be normalized on save.
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
- When you enable WPM, folder names are sanitized for URL safety (emoji removed) and any subfolders are moved to the top level.

### WPM_BASE_URL (public site integration)

Set `WPM_BASE_URL` to your public site domain (for example `example.com` or `https://example.com`). When this is set and the plugin file exists, two WPM extras are enabled:

- **Google site search**: a search input appears in the overview page. Queries are sent to Google with `site:your-domain` applied.
- **Public link in the app header**: when a note is open, a pi-externallink button appears next to the app title. It opens the public URL derived from the current note path (URL-safe, `.md` stripped).

The search and header link are only shown when `plugins/google_search_plugin.php` is present and `WPM_BASE_URL` is configured.

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

```

php -S 127.0.0.1:8000
```

Open `http://127.0.0.1:8000/index.php`.

## A quick note on exposure

MarkdownManager is meant for personal/self-hosted use. It does not provide user accounts or strong encryption. Don't expose it publicly without putting proper access controls in front of it (HTTP auth, VPN, or similar).

## Error handling and offline behavior

- Error handling: save, load, and settings actions surface clear messages in the UI (status text plus an error modal) instead of failing silently.
- Offline indicator: when the browser is offline, a red "Offline" chip appears in the header so users know saves will not reach the server.
- Offline behavior: the app is not a PWA. It won't load new pages offline, and preview/save/file loads still require the server. Once a page is loaded, you can keep typing, and some UI settings remain in localStorage, but saves will fail until you're back online.

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
- `Ctrl+Alt+S` -- save
- `Ctrl+Alt+B` -- bold (`**...**`)
- `Ctrl+Alt+I` -- italic (`*...*`)
- `Ctrl+Alt+X` -- strikethrough (`~~...~~`)
- `Ctrl+Alt+\``-- inline code (`...`)
- `Ctrl+Alt+H` -- replace (opens the replace modal)
- `Ctrl+Alt+L` -- insert link (opens the link modal)
- `Ctrl+Alt+K` -- insert link (opens the link modal)
- `Ctrl+Alt+M` -- insert image (opens the image modal)
- `Ctrl+Alt+Q` -- toggle blockquote for line(s) (`> ...`)
- `Ctrl+Alt+U` -- toggle bullet list for line(s) (`- ...`)
- `Ctrl+Alt+O` -- fenced code block (wraps with ``` fences)
- `Ctrl+Alt+/` -- comment selection ()
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
  - Folder grouping: folders plus one subfolder level (max depth 2); nested folder creation is disabled in WPM mode.
  - Folder names can include emoji in normal mode if your filesystem/locale supports UTF-8 (most Linux setups do); WPM forbids emoji for URI safety and flattens subfolders on enable.
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
- WPM extras: Google site search and public header links when `WPM_BASE_URL` is set.
- Superuser settings for publisher mode, app title, theme presets, and metadata visibility.

## Project layout

```

.
|-- index.php           # viewer (overview + reader + create/delete)
|-- edit.php            # editor (3-pane desktop, 2-row mobile)
|-- i18n.php            # translation loading + helpers
|-- html_preview.php    # shared Markdown->HTML rendering + URL resolution
|-- image_manager.php   # upload/list endpoint for the image manager modal
|-- themes_lib.php      # theme discovery (meta + fonts + available CSS)
|-- plugins/            # optional plugins (header + folder sections)
|   |-- links_plugin.php          # shortcuts section from links.csv
|   |-- html_plugin.php           # HTML/ folder section (lists .html/.htm)
|   |-- pdfs_plugin.php           # PDF/ folder section (lists .pdf)
|   |-- google_search_plugin.php  # WPM Google site search + header public link
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
|-- tools/              # reserved system folder for helper scripts (not shown in overview)
|-- example-notes/      # sample notes (safe to delete after install)
|   |-- demos/
|   |-- finance/
|   |-- health/
|   |-- linux/
|   |-- politics/
|   |-- travel/
|   |-- tutorials/
|   |-- uncategorized/
|   `-- webdev/
|-- links.csv           # optional shortcuts (CSV)
|-- secret_mds.txt      # optional list of "secret" markdown paths
`-- <folders>/*.md      # your notes
```

Note: `example-notes/` is optional sample content and can be deleted after install.

## Requirements

- PHP 8.0+ (uses `str_starts_with` / `str_ends_with`).
- A web server that can run PHP (Apache/Nginx + PHP-FPM), or PHP's built-in dev server.
- Filesystem permissions that allow the PHP process to read/write your `.md` files (for editing/creating/deleting).
  - If you get `Permission denied` when creating folders/files, the directory that contains your notes must be writable by the web server/PHP user.
  - On SELinux systems (Fedora/RHEL/CentOS), you may also need to allow HTTPD writes (e.g. `chcon -R -t httpd_sys_rw_content_t ...`).

## Markdown rendering

Rendering is implemented in PHP (a small custom parser) and is used by both `index.php` and `edit.php`.

Hot keywords:

- `{TOC}` inserts a table of contents for `###` headings and links them with numbered anchors (`#1`, `#2`, ...).

It supports a practical subset:

- Headings (`#` through `######`)
- Paragraphs
- Inline code (`code`)
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
  - Example: `example-notes/linux/note.md` with `![x](pic.png)` resolves to `example-notes/linux/pic.png`.
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

```

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

```

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

```

example-notes/finance/private.md
research/25-01-01-secret-note.md
```

Password:

- Set `SECRET_MDS_PASSWORD` in `.env`.
- If it's empty/missing, secret notes stay locked (no login possible).

Important: "secret" is only a lightweight UI/session gate; it does not encrypt files.

### Shortcuts (`links.csv`)

If `links.csv` exists, it is shown as a "Shortcuts" section (via the links plugin).

The parser expects a header row and at least two columns:

```

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

- 0.4.1: WPM publish-state logic fixes, publish-date automation, metadata date field exposure, export/copy cleanup, custom CSS + theme override persistence, mobile resizer + toolbar overhaul, and tighter superuser-only actions.
- 0.4: Explorer drag-and-drop for notes + folders, in-place folder rename, improved tree view (icons + focused view), example-notes moved under `example-notes/`, and localized/friendlier image manager errors with clearer `IMAGES_DIR` guidance.
- 0.3.3: Security hardening, smarter errors/offline awareness, {TOC} + HTML preview upgrades, metadata delimiter migration, two-level folders with WPM migration rules, and superuser folder management.
- 0.3.1.2: Settings modal cleanup, copy workflow upgrades (preview + code blocks), HTML copy modes, post date formatting/alignment, and JSON settings import/export.
- 0.3.1.1: WPM bugfixes for title-first MD creation with slug validation, date prefix default behavior, and superuser-only slug changes.
- 0.3.1: Major translation effort (DE/FR/PT UI + localized tutorials), language-aware onboarding in WPM, HTML preview upgrades (caret footnotes, inline HTML, strikethrough, themed buttons, stronger link parsing), AJAX save + replace modal, and complementary secondary accent.
- 0.3: Website publication mode with metadata-driven publish states, author/subtitle requirements, server-saved settings, and UI enhancements (explorer sorting, date display, mobile layout refinements, app title override, settings cleanup).
- 0.2.1: Theme support (file-based themes + per-user overrides), HTML export/copy from the editor, built-in image manager (upload + browse + insert), reserved `themes/` + `images/` folders (configurable in `.env`), improved MathJax rendering in live preview, and a handful of editor/mobile UX fixes (modal overlap, responsive toolbar).
- 0.2: Plugin-based explorer (HTML/PDF/links), shared `explorer_view.php`, improved folder UX (toggle state, back caret), header SVG logo, +MD folder dropdown, internal/external link modal (with search), and `.md` links route via `index.php?file=...` for subfolder installs.
- 0.1.2: Clear filter button + Delete key deletes the current note (preview mode).
- 0.1.1: Markdown images (`![alt](url)`) + relative paths resolved from the `.md` directory.
- 0.1.0: Initial public release.

## TODO (Roadmap)

- [x] Add functionality for the explorer to drag and drop md files to other folders.
- [ ] Tagging (frontmatter or inline `#tags`) + tag browser.
- [ ] Improve Markdown parser edge cases (nested lists, tables, better code fences).
- [ ] Syntax highlighting in preview (server-side or client-side).
- [ ] Offline-friendly MathJax option (self-hosted instead of CDN).
