#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
    echo "Usage: $0 SOURCE_JINJA_ENV SSH_HOST:TARGET_JINJA_ENV" >&2
    exit 64
fi

source_dir=${1%/}
target_dir=${2%/}

if [[ ! -d "$source_dir" ]]; then
    echo "Missing shared Jinja environment: $source_dir" >&2
    exit 66
fi

rsync -az --delete \
    --exclude='.git/' \
    --exclude='__pycache__/' \
    --exclude='node_modules/' \
    --exclude='venv_jinja/' \
    "$source_dir/" "$target_dir/"
