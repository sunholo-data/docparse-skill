#!/bin/bash
# List available sample files for testing
set -euo pipefail

DOCPARSE_URL="${DOCPARSE_URL:-https://ailang-dev-docparse-api-ejjw6zt3bq-ew.a.run.app}"

result=$(curl -s --max-time 15 "$DOCPARSE_URL/api/v1/samples")

echo "$result" | python3 -c "
import json, sys
data = json.loads(sys.stdin.read())
if 'result' in data:
    inner = json.loads(data['result'])
else:
    inner = data
samples = inner.get('samples', [])
print(f'{len(samples)} sample files available:\n')
for s in samples:
    print(f\"  {s['id']:30s} {s['format']:6s}  {s['path']}\")
" 2>/dev/null || echo "$result"
