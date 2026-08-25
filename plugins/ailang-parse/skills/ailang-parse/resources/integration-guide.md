# AILANG Parse Integration Guide

Two directions: **parse** a document into blocks, or **generate** one from
Markdown. Both are shown in each language below.

## Python

```python
import requests, json

API_BASE = "https://docparse.ailang.sunholo.com"
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

Generate a document — write Markdown, upload it, decode on `encoding`:

```python
import base64

with open("report.md", "rb") as fh:
    resp = requests.post(
        f"{API_BASE}/api/v1/convert",
        files={"filepath": ("report.md", fh)},
        data={"target": "docx", "apiKey": API_KEY},
    )
out = resp.json()
# Unwrap the serve-api envelope, same as /parse
if isinstance(out.get("result"), str):
    out = json.loads(out["result"])

# encoding is load-bearing: base64 for docx/pptx/xlsx/odt/odp/ods,
# utf8 for html/md/qmd. Branch on it, never on the target.
payload = (base64.b64decode(out["content"]) if out["encoding"] == "base64"
           else out["content"].encode("utf-8"))

with open(out["filename"], "wb") as fh:
    fh.write(payload)
```

## TypeScript / JavaScript

```typescript
const API_BASE = "https://docparse.ailang.sunholo.com";
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

Generate a document — write Markdown, upload it, decode on `encoding`:

```typescript
const form = new FormData();
form.append("filepath", new Blob([markdownText], { type: "text/markdown" }), "report.md");
form.append("target", "docx");
form.append("apiKey", API_KEY);

let out = await (await fetch(`${API_BASE}/api/v1/convert`, { method: "POST", body: form })).json();
// Unwrap the serve-api envelope, same as /parse
if (typeof out.result === "string") out = JSON.parse(out.result);

// encoding is load-bearing: base64 for docx/pptx/xlsx/odt/odp/ods,
// utf8 for html/md/qmd. Branch on it, never on the target.
const bytes = out.encoding === "base64"
  ? Uint8Array.from(atob(out.content), c => c.charCodeAt(0))
  : new TextEncoder().encode(out.content);

await writeFile(out.filename, bytes);   // node:fs/promises
```

## curl

```bash
# Parse (apiKey in JSON body, not as a header)
curl -X POST https://docparse.ailang.sunholo.com/api/v1/parse \
  -H "Content-Type: application/json" \
  -d '{"filepath":"data/test_files/sample.docx","outputFormat":"blocks","apiKey":"dp_your_key_here"}'

# Generate a docx from Markdown (upload; response carries the file inline)
curl -X POST https://docparse.ailang.sunholo.com/api/v1/convert \
  -F "filepath=@report.md" -F "target=docx" -F "apiKey=dp_your_key_here" \
  | python3 -c 'import base64,json,sys; d=json.load(sys.stdin); d=json.loads(d["result"]) if isinstance(d.get("result"),str) else d; \
open(d["filename"],"wb").write(base64.b64decode(d["content"]) if d["encoding"]=="base64" else d["content"].encode())'

# Estimate cost (no auth needed)
curl -X POST https://docparse.ailang.sunholo.com/api/v1/estimate \
  -H "Content-Type: application/json" \
  -d '{"filepath":"report.pdf","outputFormat":"blocks"}'

# List samples (no auth needed)
curl https://docparse.ailang.sunholo.com/api/v1/samples

# Health check
curl https://docparse.ailang.sunholo.com/api/v1/health

# Device auth flow (for agents)
curl -X POST https://docparse.ailang.sunholo.com/api/v1/auth/device \
  -H "Content-Type: application/json" \
  -d '{"args":["my-agent","parse"]}'
# → Open verification_url in browser, approve, then poll:
curl -X POST https://docparse.ailang.sunholo.com/api/v1/auth/device/poll \
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
    server_url="https://docparse.ailang.sunholo.com"
)
```

The `/general/v0/general` endpoint returns identical element JSON.
