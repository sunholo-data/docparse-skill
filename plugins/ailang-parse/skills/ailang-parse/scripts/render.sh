#!/usr/bin/env bash
# Local companion shipped by AILANG Parse; never uploads a document.
set -euo pipefail
exec_path="${DOCPARSE_RENDER_BIN:-docparse-render}"
if ! command -v "$exec_path" >/dev/null 2>&1; then
  echo 'docparse-render is missing. Update the local AILANG Parse install, or set DOCPARSE_RENDER_BIN to its bin/docparse-render.' >&2
  exit 2
fi
exec "$exec_path" "$@"
