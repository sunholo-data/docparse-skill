#!/bin/bash
# Parse a document via DocParse API
# Usage: bash scripts/parse.sh <filepath> [output_format]
set -euo pipefail

DOCPARSE_URL="${DOCPARSE_URL:-https://ailang-dev-docparse-api-ejjw6zt3bq-ew.a.run.app}"
DOCPARSE_API_KEY="${DOCPARSE_API_KEY:-}"

filepath="${1:-}"
output_format="${2:-blocks}"

if [ -z "$filepath" ]; then
  echo "Usage: bash scripts/parse.sh <filepath> [output_format]"
  echo "  filepath:      path to document (or sample_id from /api/v1/samples)"
  echo "  output_format: blocks (default), markdown, html, a2ui"
  exit 1
fi

if [ -z "$DOCPARSE_API_KEY" ]; then
  echo "Error: DOCPARSE_API_KEY not set. Get a key at https://sunholo-data.github.io/docparse/dashboard.html"
  echo "Or run: bash scripts/device-auth.sh"
  exit 1
fi

result=$(curl -s --max-time 60 -X POST "$DOCPARSE_URL/api/v1/parse" \
  -H "Content-Type: application/json" \
  -d "{\"filepath\":\"$filepath\",\"outputFormat\":\"$output_format\",\"apiKey\":\"$DOCPARSE_API_KEY\"}")

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
