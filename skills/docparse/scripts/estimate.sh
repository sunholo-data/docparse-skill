#!/bin/bash
# Estimate parsing cost before committing
# Usage: bash scripts/estimate.sh <filepath> [output_format]
set -euo pipefail

DOCPARSE_URL="${DOCPARSE_URL:-https://ailang-dev-docparse-api-ejjw6zt3bq-ew.a.run.app}"
DOCPARSE_API_KEY="${DOCPARSE_API_KEY:-}"

filepath="${1:-}"
output_format="${2:-blocks}"

if [ -z "$filepath" ]; then
  echo "Usage: bash scripts/estimate.sh <filepath> [output_format]"
  exit 1
fi

if [ -z "$DOCPARSE_API_KEY" ]; then
  echo "Error: DOCPARSE_API_KEY not set."
  exit 1
fi

result=$(curl -s --max-time 15 -X POST "$DOCPARSE_URL/api/v1/estimate" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $DOCPARSE_API_KEY" \
  -d "{\"filepath\":\"$filepath\",\"output_format\":\"$output_format\"}")

echo "$result" | python3 -c "
import json, sys
data = json.loads(sys.stdin.read())
if 'result' in data:
    inner = json.loads(data['result'])
    print(json.dumps(inner, indent=2))
else:
    print(json.dumps(data, indent=2))
" 2>/dev/null || echo "$result"
