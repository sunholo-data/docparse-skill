#!/bin/bash
# Estimate parsing cost before committing
# Usage: bash scripts/estimate.sh <filepath> [output_format]
set -euo pipefail

DOCPARSE_URL="${DOCPARSE_URL:-https://docparse.ailang.sunholo.com}"
DOCPARSE_API_KEY="${DOCPARSE_API_KEY:-}"

filepath="${1:-}"
output_format="${2:-blocks}"

if [ -z "$filepath" ]; then
  echo "Usage: bash scripts/estimate.sh <filepath> [output_format]"
  exit 1
fi

# No API key needed. A local file is uploaded (the hosted API cannot read the
# caller's disk); anything else is taken as a sample_id.
if [ -f "$filepath" ]; then
  result=$(curl -s --max-time 60 -X POST "$DOCPARSE_URL/api/v1/estimate" \
    -F "filepath=@${filepath}" -F "outputFormat=${output_format}")
else
  result=$(curl -s --max-time 15 -X POST "$DOCPARSE_URL/api/v1/estimate" \
    -H "Content-Type: application/json" \
    -d "{\"filepath\":\"$filepath\",\"outputFormat\":\"$output_format\"}")
fi

echo "$result" | python3 -c "
import json, sys
data = json.loads(sys.stdin.read())
if 'result' in data:
    inner = json.loads(data['result'])
    print(json.dumps(inner, indent=2))
else:
    print(json.dumps(data, indent=2))
" 2>/dev/null || echo "$result"
