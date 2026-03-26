#!/bin/bash
# Fetch full capability manifest
set -euo pipefail

DOCPARSE_URL="${DOCPARSE_URL:-https://ailang-dev-docparse-api-ejjw6zt3bq-ew.a.run.app}"

result=$(curl -s --max-time 30 "$DOCPARSE_URL/api/v1/capabilities")

echo "$result" | python3 -c "
import json, sys
data = json.loads(sys.stdin.read())
if 'result' in data:
    inner = json.loads(data['result'])
else:
    inner = data
print(json.dumps(inner, indent=2))
" 2>/dev/null || echo "$result"
