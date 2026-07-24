# WPM Instance Onboarding

Use this checklist when adding a new MarkdownManager WPM site.

## Ownership And Paths

- `<instance>/edit/` contains PHP and Markdown; `<instance>/static/` is its sibling for editor assets and images.
- Keep `bin/`, `deploy/`, renderer code, and sync helpers outside `edit/`.
- vBook editor: `/srv/vbook_web/<instance>/edit`.
- vBook renderer: `/home/henk/jinja_websites/<site>_site`.
- Local Jinja source: `/home/henk/Documents/jinja_websites/<site>_site`.
- Local Markdown shadow copy: `/home/henk/vbook_web/<instance>/edit`.

The instance name and site name are not required to match. Verify the actual renderer path, for example `wch_NL_site`.

## Instance Configuration

Create `<instance>/edit/.env` without committing it. Configure these keys without exposing their values:

- `SSH_ADDRESS`, `SSH_DIR`, `SSH_USER`, `SSH_PWD`
- `WPM_SITE_DIR`
- `WPM_SYNC_LOCAL_EDIT_DIR`, `WPM_SYNC_REMOTE_EDIT_DIR`
- `WPM_BASE_URL`, `WPM_EDITOR_URL`, `WPM_NTFY_TOPIC`

Copy the editor core and translations into the instance. Verify PHP syntax and the live editor URL.

## vBook Publisher

Install and enable only the shared units `wpm-publish@<instance>.service` and `wpm-publish@<instance>.timer`.

The intended schedule is:

```ini
OnCalendar=*-*-* 00..06:00:00
OnCalendar=*-*-* 07..23:0/5:00
```

`Processing` is the explicit publish request. A successful render and upload changes the Markdown state to `Published` on vBook and live. A run without Processing files is successful but sends no success notification.

`WPM_NTFY_TOPIC` sends success and failure notifications containing the site, file, and error details. Audit for duplicate legacy timers, cronjobs, or publisher processes before enabling a new instance.

## Local Template Feedback Loop

Install the shared helper and systemd templates:

- `/home/henk/.local/bin/wpm_minipc_sync.py`
- `deploy/systemd/wpm-minipc-sync@.service`
- `deploy/systemd/wpm-minipc-sync@.timer`

Enable `wpm-minipc-sync@<instance>.timer` on the minipc. It runs hourly and:

- pulls Markdown from vBook;
- reconciles managed generated templates back to the local Jinja source;
- pushes the site-owned `templates/base.html` to the vBook renderer.

The helper reads `WPM_SITE_DIR` from `/home/henk/vbook_web/<instance>/edit/.env` and derives the local Jinja directory from its basename. Do not assume `<instance>_site` when the site uses a different name or casing.

Review `.wpm-minipc-sync/state.json` and the service journal after the first run. Template conflicts must stop for manual resolution; never overwrite local source blindly.

## Verification

1. Run `php -l` on changed PHP files and `python3 -m py_compile` on sync/publish helpers.
2. Check `is-enabled`, `is-active`, and `list-timers` for both vBook and minipc units.
3. Run one controlled publisher and sync cycle.
4. Inspect `.wpm-status.json`, `.wpm-minipc-sync/state.json`, and journals.
5. Check live editor, generated pages, and static asset URLs with HTTP status checks.
6. Keep credentials and client-specific settings out of the generic README.
