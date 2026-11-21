#!/bin/sh
set -eu
task_root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if command -v python3 >/dev/null 2>&1; then
    py=python3
elif command -v python >/dev/null 2>&1; then
    py=python
else
    printf 'Error: python3 or python is required.\n' >&2
    exit 1
fi
exec "$py" "$task_root/tools/setup-linux-launcher.py" "$@"
