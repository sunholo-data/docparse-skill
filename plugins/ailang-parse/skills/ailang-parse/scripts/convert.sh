#!/bin/bash
# Convert a document to another format via the AILANG Parse API, and write the
# result to disk.
# Usage: bash scripts/convert.sh <input> <target> [output_path]
set -euo pipefail

DOCPARSE_URL="${DOCPARSE_URL:-https://docparse.ailang.sunholo.com}"
DOCPARSE_API_KEY="${DOCPARSE_API_KEY:-}"

input="${1:-}"
target="${2:-}"
output_path="${3:-}"

if [ -z "$input" ] || [ -z "$target" ]; then
  echo "Usage: bash scripts/convert.sh <input> <target> [output_path]"
  echo "  input:       local file path, a sample_id, an https:// URL, or a gs:// ref"
  echo "  target:      html md qmd docx pptx xlsx odt odp ods"
  echo "  output_path: where to write the result (default: the filename the API returns)"
  echo
  echo "To author a document, write Markdown and convert it:"
  echo "  bash scripts/convert.sh report.md docx"
  exit 1
fi

if [ -z "$DOCPARSE_API_KEY" ]; then
  echo "Error: DOCPARSE_API_KEY not set. Get a key at https://www.sunholo.com/docparse/dashboard.html"
  echo "Or run: bash scripts/device-auth.sh"
  exit 1
fi

# Four input modes, mutually exclusive server-side (sourceUrl > gcsRef > filepath).
# A local file must be UPLOADED — the hosted API cannot see the caller's disk —
# so it goes as multipart. Everything else is a reference and goes as JSON.
if [ -f "$input" ]; then
  response=$(curl -s --max-time 120 -X POST "$DOCPARSE_URL/api/v1/convert" \
    -F "filepath=@${input}" \
    -F "target=${target}" \
    -F "apiKey=${DOCPARSE_API_KEY}")
else
  case "$input" in
    https://*|http://*) field="sourceUrl" ;;
    gs://*)             field="gcsRef"    ;;
    *)                  field="filepath"  ;;  # sample_id
  esac
  response=$(curl -s --max-time 120 -X POST "$DOCPARSE_URL/api/v1/convert" \
    -H "Content-Type: application/json" \
    -d "{\"${field}\":\"${input}\",\"target\":\"${target}\",\"apiKey\":\"${DOCPARSE_API_KEY}\"}")
fi

# `encoding` is load-bearing: base64 for the six ZIP container targets, utf8 for
# html/md/qmd. Branch on it, never on the target — that is the one mistake this
# endpoint invites.
OUT_PATH="$output_path" python3 -c '
import base64, json, os, sys

data = json.loads(sys.stdin.read())

# The live API wraps BOTH success and failure in a {"result": "<json string>"}
# envelope, despite convertDocument being annotated @nowrap. Unwrap first and
# branch second — reading `status` off the envelope sees nothing and reports an
# empty error on a conversion that actually worked.
if isinstance(data.get("result"), str):
    try:
        data = json.loads(data["result"])
    except ValueError:
        pass

if data.get("status") != "success":
    inner = data.get("result", data)
    if isinstance(inner, str):
        try:
            inner = json.loads(inner)
        except ValueError:
            pass
    err = inner.get("error", inner) if isinstance(inner, dict) else inner
    if isinstance(err, dict):
        code = err.get("code", "ERROR")
        message = err.get("message", "")
        fix = err.get("suggested_fix", "")
        print(f"{code}: {message}", file=sys.stderr)
        if fix:
            print(f"  fix: {fix}", file=sys.stderr)
    else:
        print(json.dumps(inner, indent=2), file=sys.stderr)
    sys.exit(1)

out = os.environ.get("OUT_PATH") or data["filename"]
content, encoding = data["content"], data["encoding"]

if encoding == "base64":
    payload = base64.b64decode(content)
elif encoding == "utf8":
    payload = content.encode("utf-8")
else:
    print(f"Unknown encoding {encoding!r} — refusing to guess.", file=sys.stderr)
    sys.exit(1)

with open(out, "wb") as fh:
    fh.write(payload)

ctype, size = data["content_type"], data["size_bytes"]
src, tgt, req = data["source_subtype"], data["target"], data["request_id"]
print(f"Wrote {out} ({ctype}, {size} bytes)")
print(f"  source: {src} -> {tgt}")
print(f"  request_id: {req}")
' <<<"$response"
