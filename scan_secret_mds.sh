#!/usr/bin/env bash
BASE="/"
OUT="$BASE/secret_mds.txt"

PATTERN='password|passwd|api[_-]?key|secret|token|client[_-]?secret|auth'

grep -Rli --include="*.md" -E "$PATTERN" "$BASE" \
  | sed "s#^$BASE/##" \
  | sort -u > "$OUT"

echo "Secret MD lijst: $OUT"
wc -l "$OUT"
