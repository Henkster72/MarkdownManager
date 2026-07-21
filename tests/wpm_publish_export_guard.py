#!/usr/bin/env python3
"""Regression guard: editor preview markup must never become a Jinja template."""

import importlib.util
from pathlib import Path


module_path = Path(__file__).resolve().parents[1] / "bin" / "wpm_publish.py"
spec = importlib.util.spec_from_file_location("wpm_publish", module_path)
if spec is None or spec.loader is None:
    raise SystemExit("Could not load wpm_publish.py")
publisher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publisher)

publisher.ensure_publishable_template('{% extends "base.html" %}', "clean.md")

for marker in publisher.PREVIEW_EXPORT_MARKERS:
    try:
        publisher.ensure_publishable_template(
            f'{{% extends "base.html" %}}<div {marker}="x"></div>',
            "broken.md",
        )
    except RuntimeError:
        continue
    raise SystemExit(f"Publisher accepted preview marker: {marker}")

print("WPM publish export guard checks passed")
