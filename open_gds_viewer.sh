#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${script_dir}"

if [[ -x ".venv/bin/gdsviewer" ]]; then
  exec ".venv/bin/gdsviewer" "$@"
fi

if [[ -x ".venv/Scripts/gdsviewer.exe" ]]; then
  exec ".venv/Scripts/gdsviewer.exe" "$@"
fi

if ! command -v uv >/dev/null 2>&1; then
  echo "uv is required. Install it from https://docs.astral.sh/uv/" >&2
  exit 1
fi

exec uv run gdsviewer "$@"
