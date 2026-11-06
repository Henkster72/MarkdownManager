#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('wpm_publish', ROOT / 'bin' / 'wpm_publish.py')
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

assert module.canonical_date_value('Nov 6, 2026') == '2026-11-06'
assert module.canonical_date_value('November 6, 2026') == '2026-11-06'
assert module.canonical_date_value('2026-11-06') == '2026-11-06'

print('WPM publisher date normalization regression checks passed')
