#!/bin/bash
# Device authorization flow — get an API key without a browser session
# The user approves via a URL, then this script polls until approved.
set -euo pipefail

DOCPARSE_URL="${DOCPARSE_URL:-https://ailang-dev-docparse-api-ejjw6zt3bq-ew.a.run.app}"
LABEL="${1:-claude-code}"

echo "Requesting device authorization..."
echo ""

# Step 1: Request device code
result=$(curl -s --max-time 15 -X POST "$DOCPARSE_URL/api/v1/auth/device" \
  -H "Content-Type: application/json" \
  -d "{\"args\":[\"$LABEL\",\"parse\"]}")

# Extract fields from serve-api envelope
device_code=$(echo "$result" | python3 -c "
import json, sys
data = json.loads(sys.stdin.read())
r = json.loads(data.get('result', '{}')) if isinstance(data.get('result'), str) else data
print(r.get('device_code', ''))
" 2>/dev/null)

user_code=$(echo "$result" | python3 -c "
import json, sys
data = json.loads(sys.stdin.read())
r = json.loads(data.get('result', '{}')) if isinstance(data.get('result'), str) else data
print(r.get('user_code', ''))
" 2>/dev/null)

verification_url=$(echo "$result" | python3 -c "
import json, sys
data = json.loads(sys.stdin.read())
r = json.loads(data.get('result', '{}')) if isinstance(data.get('result'), str) else data
print(r.get('verification_url', ''))
" 2>/dev/null)

if [ -z "$device_code" ] || [ -z "$user_code" ]; then
  echo "Error: Failed to get device code."
  echo "Response: $result"
  echo ""
  echo "Note: Device auth requires Firestore. If running locally, get a key from the dashboard instead:"
  echo "  https://sunholo-data.github.io/docparse/dashboard.html"
  exit 1
fi

echo "  User Code:        $user_code"
echo "  Verification URL: $verification_url"
echo ""
echo "Open the URL above in a browser and approve the request."
echo "Polling for approval (Ctrl+C to cancel)..."
echo ""

# Step 2: Poll for approval
for i in $(seq 1 60); do
  sleep 5
  poll_result=$(curl -s --max-time 10 -X POST "$DOCPARSE_URL/api/v1/auth/device/poll" \
    -H "Content-Type: application/json" \
    -d "{\"args\":[\"$device_code\"]}")

  status=$(echo "$poll_result" | python3 -c "
import json, sys
data = json.loads(sys.stdin.read())
r = json.loads(data.get('result', '{}')) if isinstance(data.get('result'), str) else data
if r.get('status') == 'approved':
    print('approved')
elif 'error' in r and r['error'].get('code') == 'DEVICE_CODE_EXPIRED':
    print('expired')
else:
    print('pending')
" 2>/dev/null)

  if [ "$status" = "approved" ]; then
    api_key=$(echo "$poll_result" | python3 -c "
import json, sys
data = json.loads(sys.stdin.read())
r = json.loads(data.get('result', '{}')) if isinstance(data.get('result'), str) else data
print(r.get('api_key', ''))
" 2>/dev/null)
    echo "Approved!"
    echo ""
    echo "  API Key: $api_key"
    echo ""
    echo "Set it as an environment variable:"
    echo "  export DOCPARSE_API_KEY=\"$api_key\""
    exit 0
  elif [ "$status" = "expired" ]; then
    echo "Device code expired. Run this script again."
    exit 1
  fi
  printf "."
done

echo ""
echo "Timed out after 5 minutes. Run this script again."
exit 1
