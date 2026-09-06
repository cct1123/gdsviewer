#!/usr/bin/env bash
set -euo pipefail

if (( $# > 0 )); then
  echo "Open index.html, then select or drop a .gds file in the browser." >&2
  echo "Root cell and hierarchy depth are available in View options." >&2
  exit 1
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ "$(uname -s)" == "Darwin" ]]; then
  exec open "${script_dir}/index.html"
fi
if command -v xdg-open >/dev/null 2>&1; then
  exec xdg-open "${script_dir}/index.html"
fi
echo "Open ${script_dir}/index.html in a modern browser." >&2
exit 1
