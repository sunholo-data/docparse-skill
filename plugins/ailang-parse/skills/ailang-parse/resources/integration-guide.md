# DocParse Integration Guide

## Python

```python
import requests, json

API_BASE = "https://ailang-dev-docparse-api-ejjw6zt3bq-ew.a.run.app"
API_KEY = "dp_your_key_here"

# Parse a document (apiKey is a named JSON param, not a header)
resp = requests.post(
    f"{API_BASE}/api/v1/parse",
    headers={"Content-Type": "application/json"},
    json={"filepath": "data/test_files/sample.docx", "outputFormat": "blocks", "apiKey": API_KEY}
)
data = resp.json()
result = data["result"]
# result is a JSON-encoded string for @nowrap endpoints
blocks = json.loads(result) if isinstance(result, str) else result

for block in blocks.get("blocks", []):
    if block["type"] == "heading":
        print(f"H{block['level']}: {block['text']}")
    elif block["type"] == "table":
        print(f"Table: {len(block['rows'])} rows")
    elif block["type"] == "text":
        print(block["text"][:80])
```

## TypeScript / JavaScript

```typescript
const API_BASE = "https://ailang-dev-docparse-api-ejjw6zt3bq-ew.a.run.app";
const API_KEY = "dp_your_key_here";

const resp = await fetch(`${API_BASE}/api/v1/parse`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ filepath: "data/test_files/sample.docx", outputFormat: "blocks", apiKey: API_KEY })
});

const data = await resp.json();
const blocks = typeof data.result === "string" ? JSON.parse(data.result) : data.result;

for (const block of blocks.blocks) {
  if (block.type === "heading") console.log(`H${block.level}: ${block.text}`);
  if (block.type === "table") console.log(`Table: ${block.rows.length} rows`);
}
```

## curl

```bash
# Parse (apiKey in JSON body, not as a header)
curl -X POST https://ailang-dev-docparse-api-ejjw6zt3bq-ew.a.run.app/api/v1/parse \
  -H "Content-Type: application/json" \
  -d '{"filepath":"data/test_files/sample.docx","outputFormat":"blocks","apiKey":"dp_your_key_here"}'

# Estimate cost (no auth needed)
curl -X POST https://ailang-dev-docparse-api-ejjw6zt3bq-ew.a.run.app/api/v1/estimate \
  -H "Content-Type: application/json" \
  -d '{"filepath":"report.pdf","outputFormat":"blocks"}'

# List samples (no auth needed)
curl https://ailang-dev-docparse-api-ejjw6zt3bq-ew.a.run.app/api/v1/samples

# Health check
curl https://ailang-dev-docparse-api-ejjw6zt3bq-ew.a.run.app/api/v1/health

# Device auth flow (for agents)
curl -X POST https://ailang-dev-docparse-api-ejjw6zt3bq-ew.a.run.app/api/v1/auth/device \
  -H "Content-Type: application/json" \
  -d '{"args":["my-agent","parse"]}'
# → Open verification_url in browser, approve, then poll:
curl -X POST https://ailang-dev-docparse-api-ejjw6zt3bq-ew.a.run.app/api/v1/auth/device/poll \
  -H "Content-Type: application/json" \
  -d '{"args":["<device_code_from_step_1>"]}'
```

## Unstructured.io Migration

If you're using the Unstructured Python SDK, change one line:

```python
from unstructured_client import UnstructuredClient

# Before
client = UnstructuredClient(server_url="https://api.unstructured.io")

# After — one line change
client = UnstructuredClient(
    server_url="https://ailang-dev-docparse-api-ejjw6zt3bq-ew.a.run.app"
)
```

The `/general/v0/general` endpoint returns identical element JSON.
