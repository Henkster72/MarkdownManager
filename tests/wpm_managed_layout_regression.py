#!/usr/bin/env python3
"""Regression checks for site-configured WPM managed-template layouts."""

import importlib.util
import json
import tempfile
from pathlib import Path


module_path = Path(__file__).resolve().parents[1] / "bin" / "wpm_publish.py"
spec = importlib.util.spec_from_file_location("wpm_publish", module_path)
if spec is None or spec.loader is None:
    raise SystemExit("Could not load wpm_publish.py")
publisher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publisher)


with tempfile.TemporaryDirectory() as temp_dir:
    site_dir = Path(temp_dir)
    (site_dir / "templates/layouts").mkdir(parents=True)
    (site_dir / "templates/layouts/markdown_page.html").write_text(
        '{% block markdown_body %}{{ markdown_html | safe }}{% endblock markdown_body %}\n',
        encoding="utf-8",
    )
    (site_dir / "site_config.json").write_text(
        json.dumps({"markdown": {"default_layout": "layouts/markdown_page.html"}}),
        encoding="utf-8",
    )
    source = site_dir / "article.md"
    source.write_text("{page_title: Article}\n\nText\n", encoding="utf-8")

    exported = publisher.adapt_managed_layout(
        '{% extends "base.html" %}\n{% block content %}Text{% endblock content %}',
        site_dir,
        source,
    )
    assert '{% extends "layouts/markdown_page.html" %}' in exported
    assert "{% block markdown_body %}Text{% endblock markdown_body %}" in exported

    source.write_text('{extends: base.html}\n\nText\n', encoding="utf-8")
    explicit = publisher.adapt_managed_layout(
        '{% extends "base.html" %}\n{% block content %}Text{% endblock content %}',
        site_dir,
        source,
    )
    assert explicit.startswith('{% extends "base.html" %}')

    source.write_text('{extends: layouts/markdown_page.html}\n\nText\n', encoding="utf-8")
    explicit_layout = publisher.adapt_managed_layout(
        '{% extends "layouts/markdown_page.html" %}\n{% block content %}Text{% endblock content %}',
        site_dir,
        source,
    )
    assert explicit_layout.startswith('{% extends "layouts/markdown_page.html" %}')
    assert "{% block markdown_body %}Text{% endblock markdown_body %}" in explicit_layout

print("WPM managed layout regression checks passed")
