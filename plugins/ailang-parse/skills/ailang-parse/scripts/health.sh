#!/bin/bash
# Check DocParse API health
set -euo pipefail

DOCPARSE_URL="${DOCPARSE_URL:-https://docparse.ailang.sunholo.com}"

result=$(curl -s --max-time 30 "$DOCPARSE_URL/api/v1/health")

# Parse the serve-api envelope
inner=$(echo "$result" | python3 -c "import json,sys; r=json.loads(sys.stdin.read()); print(json.dumps(json.loads(r['result']),indent=2))" 2>/dev/null || echo "$result")

echo "$inner"
