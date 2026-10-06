# AILANG Parse Integration Guide

Two directions: **parse** a document into blocks, or **generate** one from
Markdown. Both are shown in each language below.

The quickest route is an SDK, which handles uploads, the response envelope and
device sign-in: `pip install ailang-parse` (`from ailang_parse import DocParse`)
or `npm i @ailang/parse`. The raw HTTP below is for everything else.

Two rules every client must follow:

- **Upload local files** as multipart (`filepath=@…`). The API never reads a
  path on your disk; a path sent as JSON returns `INPUT_NOT_FOUND`. JSON
  `filepath` is only for `sample_…` ids.
- **Send the key as a header** (`X-API-Key` or `Authorization: Bearer`) rather
  than in the body, so it stays out of logs.

## Python

```python
import requests, json

API_BASE = "https://docparse.ailang.sunholo.com"
API_KEY = "dp_your_key_here"

# Parse a local document: upload it, key in a header
with open("report.docx", "rb") as fh:
    resp = requests.post(
        f"{API_BASE}/api/v1/parse",
        headers={"X-API-Key": API_KEY},
        files={"filepath": ("report.docx", fh)},
        data={"outputFormat": "blocks"},
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
        headers={"X-API-Key": API_KEY},
        files={"filepath": ("report.md", fh)},
        data={"target": "docx"},
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

// Upload the file (the API never reads a path on your disk); key in a header
const upload = new FormData();
upload.append("filepath", new Blob([await readFile("report.docx")]), "report.docx");  // node:fs/promises
upload.append("outputFormat", "blocks");
const resp = await fetch(`${API_BASE}/api/v1/parse`, {
  method: "POST",
  headers: { "X-API-Key": API_KEY },
  body: upload
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

let out = await (await fetch(`${API_BASE}/api/v1/convert`, {
  method: "POST", headers: { "X-API-Key": API_KEY }, body: form
})).json();
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
# Parse a local file (uploaded; key in a header)
curl -X POST https://docparse.ailang.sunholo.com/api/v1/parse \
  -H "X-API-Key: $DOCPARSE_API_KEY" \
  -F "filepath=@report.docx" -F "outputFormat=blocks"

# Parse a built-in sample (JSON filepath is only for sample ids)
curl -X POST https://docparse.ailang.sunholo.com/api/v1/parse \
  -H "X-API-Key: $DOCPARSE_API_KEY" -H "Content-Type: application/json" \
  -d '{"filepath":"sample_docx_formatting","outputFormat":"markdown"}'

# Generate a docx from Markdown (upload; response carries the file inline)
curl -X POST https://docparse.ailang.sunholo.com/api/v1/convert \
  -H "X-API-Key: $DOCPARSE_API_KEY" -F "filepath=@report.md" -F "target=docx" \
  | python3 -c 'import base64,json,sys; d=json.load(sys.stdin); d=json.loads(d["result"]) if isinstance(d.get("result"),str) else d; \
open(d["filename"],"wb").write(base64.b64decode(d["content"]) if d["encoding"]=="base64" else d["content"].encode())'

# Estimate cost (no auth needed)
curl -X POST https://docparse.ailang.sunholo.com/api/v1/estimate \
  -F "filepath=@report.pdf" -F "outputFormat=blocks"

# List samples (no auth needed)
curl https://docparse.ailang.sunholo.com/api/v1/samples

# Health check
curl https://docparse.ailang.sunholo.com/api/v1/health

# Device auth flow (for agents)
curl -X POST https://docparse.ailang.sunholo.com/api/v1/auth/device \
  -H "Content-Type: application/json" \
  -d '{"label":"my-agent","scope":"parse"}'
# → Open verification_url in browser, approve, then poll:
curl -X POST https://docparse.ailang.sunholo.com/api/v1/auth/device/poll \
  -H "Content-Type: application/json" \
  -d '{"deviceCode":"<device_code_from_step_1>"}'
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
