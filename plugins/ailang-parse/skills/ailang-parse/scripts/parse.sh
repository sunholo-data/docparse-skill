#!/bin/bash
# Parse a document via DocParse API
# Usage: bash scripts/parse.sh <filepath> [output_format]
set -euo pipefail

DOCPARSE_URL="${DOCPARSE_URL:-https://docparse.ailang.sunholo.com}"
DOCPARSE_API_KEY="${DOCPARSE_API_KEY:-}"

filepath="${1:-}"
output_format="${2:-blocks}"

if [ -z "$filepath" ]; then
  echo "Usage: bash scripts/parse.sh <filepath> [output_format]"
  echo "  filepath:      local file (uploaded), sample_id from /api/v1/samples, or https:// URL"
  echo "  output_format: blocks (default), markdown, html, a2ui"
  exit 1
fi

if [ -z "$DOCPARSE_API_KEY" ]; then
  echo "Error: DOCPARSE_API_KEY not set. Get a key at https://www.sunholo.com/docparse/dashboard.html"
  echo "Or run: bash scripts/device-auth.sh"
  exit 1
fi

# A local file must be UPLOADED: the hosted API reads only its own uploads and
# sample ids, never a path on the caller's disk (it answers INPUT_NOT_FOUND).
if [ -f "$filepath" ]; then
  result=$(curl -s --max-time 120 -X POST "$DOCPARSE_URL/api/v1/parse" \
    -H "X-API-Key: $DOCPARSE_API_KEY" \
    -F "filepath=@${filepath}" -F "outputFormat=${output_format}")
else
  case "$filepath" in
    https://*|http://*) field="sourceUrl" ;;
    *)                  field="filepath"  ;;  # sample_id
  esac
  result=$(curl -s --max-time 120 -X POST "$DOCPARSE_URL/api/v1/parse" \
    -H "Content-Type: application/json" -H "X-API-Key: $DOCPARSE_API_KEY" \
    -d "{\"${field}\":\"${filepath}\",\"outputFormat\":\"${output_format}\"}")
fi

# Try to pretty-print the inner result
echo "$result" | python3 -c "
import json, sys
data = json.loads(sys.stdin.read())
if 'result' in data:
    try:
        inner = json.loads(data['result'])
        print(json.dumps(inner, indent=2))
    except:
        print(data['result'])
    if 'meta' in data:
        print()
        print('--- Meta ---')
        print(json.dumps(data.get('meta', {}), indent=2))
else:
    print(json.dumps(data, indent=2))
" 2>/dev/null || echo "$result"
