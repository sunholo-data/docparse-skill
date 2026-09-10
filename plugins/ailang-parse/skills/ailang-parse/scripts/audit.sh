#!/usr/bin/env bash
# Read-only local DOCX audit implemented in AILANG.
set -euo pipefail
exec_path="${DOCPARSE_AUDIT_BIN:-docparse-audit}"
if ! command -v "$exec_path" >/dev/null 2>&1; then
  echo 'docparse-audit is missing. Update the local AILANG Parse install, or set DOCPARSE_AUDIT_BIN to its bin/docparse-audit.' >&2
  exit 2
fi
exec "$exec_path" "$@"
