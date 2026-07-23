# MarkdownManager Local Instructions

## Project

This directory is the source repo for the MarkdownManager app.

Source:
- `/home/henk/Documents/php_websites/markdownmanager/output`

Live mounted targets on `minipc`:
- `/home/henk/vbook_web/md`
- `/home/henk/vbook_web/naomi`
- `/home/henk/vbook_web/ntg`

Public LAN URLs are served from `vBook`, for example:
- `https://vbook.smelt-sun.ts.net/web/md/`

## Mission Critical Rule

Do not replace the MDM deploy logic with a broad one-way sync.

The live folders contain user markdown, images, local settings, secrets, and per-site configuration. Deploy only committed core app changes from this repo.

## MDM Deploy Helper

Local helper:
- `/home/henk/bin/sh/mdm_sync_run`

Timer/service:
- `/home/henk/.config/systemd/user/mdm_tracker.timer`
- `/home/henk/.config/systemd/user/mdm_tracker.service`

Expected behavior:
- deploy committed core files from this git repo
- deploy to all three targets: `md`, `naomi`, and `ntg`
- do not delete files from live targets
- do not copy uncommitted working-tree drift
- do not overwrite protected settings/secrets

Protected files that must not be overwritten by the tracker:
- `.env`
- `.env.example`
- `.gitignore`
- `links.csv`
- `secret_mds.txt`
- `metadata_config.json`
- `metadata_publisher_config.json`
- `kw_rules.json`

Repository internals must also not be deployed:
- `.git/`
- `.github/`

## Commands

Check tracker status:

```bash
mdm_status
```

Start timer:

```bash
mdm_start
```

Stop timer:

```bash
mdm_stop
```

Run deploy once:

```bash
/home/henk/bin/sh/mdm_sync_run
```

View logs:

```bash
journalctl --user -u mdm_tracker.service -n 80 --no-pager
```

## Verification

## Editor Metadata Invariant

Direct editing in the Markdown textarea must remain source-stable. Do not
rebuild or reorder the complete metadata block on each input event or during
save. Metadata changes made through the Article Metadata modal may explicitly
normalize the block. Visual-preview conversion must preserve metadata that is
not represented in the visual DOM, while an explicitly deleted Markdown key
may be removed without deleting unrelated metadata.

Before deploy:

```bash
git status --short
git diff-tree --no-commit-id --name-only -r HEAD
```

After deploy, compare changed code files only. Do not compare or overwrite protected settings files.

Example:

```bash
diff -q static/mdm.editor.js /home/henk/vbook_web/md/static/mdm.editor.js
diff -q static/mdm.editor.js /home/henk/vbook_web/naomi/static/mdm.editor.js
diff -q static/mdm.editor.js /home/henk/vbook_web/ntg/static/mdm.editor.js
```
