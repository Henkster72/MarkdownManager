# Visual Editor Invariants

- Preserve every valid frontmatter field, including unknown and hidden fields.
- User input in the visual preview must not be overwritten by a stale server preview response.
- Internal metadata normalization must not schedule a preview render.
- Generated sections, macros, metadata, and TOC controls remain non-editable.
- Do not use a full preview-to-Markdown serialization as a cursor-placement mechanism.
