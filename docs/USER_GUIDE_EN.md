# MarkdownManager User Guide

This guide is for regular users who edit pages and articles. Administrator settings, theme choices, and technical Markdown settings are outside its scope.

## Overview

The page has three parts:

- **Overview** on the left: folders and pages. Click a folder to open it and a page to edit it.
- **Visual editor** in the middle: edit content and use the formatting buttons.
- **Preview** on the right: see how the page will look on the website.

Use the filter above the folder list to find a page quickly. Sorting controls the order within a folder. In WPM mode, recent pages normally appear first.

## Open and create a page

Click an existing page on the left to open it.

Use the new-page button to add a page. Then choose:

- the folder where the page belongs;
- **Page title**;
- a filename, which is usually generated from the title;
- optionally a **Page subtitle**, **Header image**, author, and date.

For **Header image**, you can search the available images or upload an image. The date defaults to today's date.

When visual mode is active and no page is open, clicking the preview also opens the new-page dialog.

## Edit text

Click in the visual editor where you want to type. Select text before applying formatting.

The main toolbar buttons are:

| Button | Function |
| --- | --- |
| Save | Saves changes as a concept. |
| Gear | Opens page metadata such as title, subtitle, header image, author, and date. |
| Code | Shows or hides the Markdown source. |
| B | Makes selected text bold. |
| I | Makes selected text italic. |
| U | Underlines selected text. |
| Link | Adds an internal or external link to selected text. |
| Image | Searches, chooses, or uploads an image and inserts it at the cursor position. |
| L / C / R | Aligns selected text left, center, or right. |
| H | Chooses a heading level. In WPM pages, use H3 or lower for subheadings in most cases. |
| Quote | Creates a blockquote. |
| Numbered list | Creates a numbered list. |
| List | Creates a bulleted list. |
| Table | Inserts a table. |
| Undo | Reverts unsaved changes to the last saved version. |

Some installations provide extra controls, such as a table of contents or preset sections. Use only sections configured for the site.

## Links

First select the text that should become clickable, then click **Link**.

- Choose **Internal link** for a page on the same website. Search for and choose the page from the list.
- Choose **External link** for a complete web address, such as `https://example.com`.
- An existing internal link opens automatically in internal-link mode.

For visitors, internal links are shown without technical filename extensions. Do not add `.md`.

## Images

Click **Image** to open the image picker.

1. Search for an existing image or choose a folder.
2. Click the image to insert it at the cursor position.
3. Use **Upload** when the image is not available yet.

For a header image, use **Page metadata**. This keeps the image connected to the page and places it correctly.

## Page metadata

Open **Page metadata** with the gear button. This is where you change the page information:

- **Page title**: the main name of the page;
- **Page subtitle**: explanatory text beneath the title;
- **Header image**: the main image for the page;
- **Author** and **Date**: used by the site where configured.

The slug or technical filename is not needed for normal use. Change metadata before submitting the page for processing.

## Find and replace

Use `Ctrl+Shift+F` to search the open page. Use `Ctrl+Shift+H` to show a replacement field as well.

The search bar is at the top right of the editor so the text remains visible. Use the arrows to move to the next or previous match. When replacing, you can replace the current match, skip it, or replace all matches. Always confirm what you want to change.

## Save and publish

Regular users work with these statuses:

- **Concept**: the page is saved but not ready for publication.
- **Send for processing** (paper-plane button): submits a concept for review and publication.
- **Published**: the page has been processed successfully and is live. The administrator or publication service sets this status.

Save first. Then click the paper-plane button when the content is ready. The page moves to **Processing**; you do not need to publish it live yourself.

## Recommended workflow

1. Open or create a page in the correct folder.
2. Fill in the title, subtitle, and header image through Page metadata.
3. Write and format the content in the visual editor.
4. Check the preview.
5. Save as a concept.
6. Submit it with the paper-plane button when it is ready for review.

Use **Undo** only to discard unsaved changes. A saved page can always be opened again and edited further.
