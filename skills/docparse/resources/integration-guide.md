# DocParse Integration Guide

## Python

```python
import requests

API_BASE = "https://ailang-dev-docparse-api-ejjw6zt3bq-ew.a.run.app"
API_KEY = "dp_your_key_here"

# Parse a document
resp = requests.post(
    f"{API_BASE}/api/v1/parse",
    headers={"x-api-key": API_KEY, "Content-Type": "application/json"},
    json={"filepath": "data/test_files/sample.docx", "output_format": "blocks"}
)
data = resp.json()
blocks = json.loads(data["result"])

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
  headers: { "x-api-key": API_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ filepath: "data/test_files/sample.docx", output_format: "blocks" })
});

const data = await resp.json();
const blocks = JSON.parse(data.result);

for (const block of blocks.blocks) {
  if (block.type === "heading") console.log(`H${block.level}: ${block.text}`);
  if (block.type === "table") console.log(`Table: ${block.rows.length} rows`);
}
```

## curl

```bash
# Parse
curl -X POST https://ailang-dev-docparse-api-ejjw6zt3bq-ew.a.run.app/api/v1/parse \
  -H "Content-Type: application/json" \
  -H "x-api-key: dp_your_key_here" \
  -d '{"filepath":"data/test_files/sample.docx","output_format":"blocks"}'

# Estimate cost
curl -X POST https://ailang-dev-docparse-api-ejjw6zt3bq-ew.a.run.app/api/v1/estimate \
  -H "Content-Type: application/json" \
  -H "x-api-key: dp_your_key_here" \
  -d '{"filepath":"report.pdf","output_format":"blocks"}'

# List samples (no auth needed)
curl https://ailang-dev-docparse-api-ejjw6zt3bq-ew.a.run.app/api/v1/samples

# Health check
curl https://ailang-dev-docparse-api-ejjw6zt3bq-ew.a.run.app/api/v1/health
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
