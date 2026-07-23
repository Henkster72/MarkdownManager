#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('wpm_publish', ROOT / 'bin' / 'wpm_publish.py')
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

calls = []


def fake_run(command, **kwargs):
    calls.append((command, kwargs))


module.subprocess.run = fake_run
module.notify_ntfy(
    {'WPM_NTFY_TOPIC': 'henk_vbook_health/vbook'},
    'nlslank',
    'WPM nlslank: render geslaagd',
    'Site: nlslank\nBestanden: aandoeningen/diabetes.md',
    'white_check_mark,computer',
)

assert len(calls) == 1
command = calls[0][0]
assert 'https://ntfy.sh/henk_vbook_health/vbook' in command
assert 'Title: WPM nlslank: render geslaagd' in command
assert 'Site: nlslank\nBestanden: aandoeningen/diabetes.md' in command

calls.clear()
module.notify_ntfy({}, 'nlslank', 'unused', 'unused', 'warning')
assert calls == []

print('WPM publish ntfy regression checks passed')
