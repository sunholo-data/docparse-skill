# DocParse API Reference

## Base URL

```
https://docparse.ailang.sunholo.com
```

## Authentication

Parse endpoints require an API key passed as `apiKey` in the JSON body.

Key format: `dp_` followed by 32 hex characters (e.g., `dp_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6`).

Discovery endpoints (health, formats, capabilities, samples, pricing, tools) are unauthenticated.

## Response Envelope

All responses use the serve-api envelope:

```json
{
  "result": "...",       // JSON-encoded response (string)
  "module": "api_server",
  "func": "parseFile",
  "elapsed_ms": 11,
  "meta": {              // v0.9.0: response metadata
    "request_id": "req_abc123...",
    "quota_used": 1,
    "quota_remaining": 59,
    "replayable": true,
    "sample_id": ""
  }
}
```

The `result` field contains a JSON-encoded string. Parse it to get the actual data.

## POST /api/v1/parse

Parse a document into structured blocks.

**Request (named params — preferred):**
```json
{
  "filepath": "data/test_files/sample.docx",
  "outputFormat": "blocks",
  "apiKey": "dp_your_key_here"
}
```

**Request (legacy positional — still supported):**
```json
{
  "args": ["data/test_files/sample.docx", "blocks"]
}
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| filepath | string | yes | File path on server or sample_id |
| outputFormat | string | no | `blocks` (default), `markdown`, `html`, `a2ui` |
| apiKey | string | yes | API key with `dp_` prefix |

**Response (result field, decoded):**

```json
{
  "blocks": [
    {"type": "heading", "level": 1, "text": "Report Title"},
    {"type": "text", "text": "Paragraph content..."},
    {"type": "table", "rows": [["A1", "B1"], ["A2", "B2"]]},
    {"type": "change", "change_type": "insertion", "author": "Jane", "text": "added text"}
  ],
  "metadata": {
    "title": "Sample Document",
    "format": "docx",
    "pages": 3
  }
}
```

## POST /api/v1/convert

Generate a document in a target format. Deterministic conversion — the input is
parsed to blocks, then a generator writes the target. Same generator code the
`docparse` CLI runs.

**Targets:** `html` `md` `qmd` `docx` `pptx` `xlsx` `odt` `odp` `ods`
(`.docx`, `DOCX`, `markdown` and `htm` are normalised; anything else returns a
typed `UNSUPPORTED_TARGET_FORMAT`, never a 500).

**Input modes** — mutually exclusive, same as `/api/v1/parse`:

| Mode | Field | Notes |
|---|---|---|
| Multipart upload | `filepath=@file` | The usual path — the API cannot read your disk |
| Sample ID | `filepath` | e.g. `sample_docx_tables` |
| Public/signed URL | `sourceUrl` | `https://…` |
| GCS reference | `gcsRef` | `gs://…`, Business tier |

**Request (upload):**
```bash
curl -X POST https://docparse.ailang.sunholo.com/api/v1/convert \
  -F "filepath=@report.md" -F "target=docx" -F "apiKey=dp_..."
```

**Response** — the document comes back inline in JSON, not as a binary body.
Like `/api/v1/parse`, it arrives inside the serve-api envelope, so unwrap
`result` (a JSON-encoded string) before reading the fields:

```json
{"result": "{\"status\":\"success\",\"target\":\"docx\", ...}"}
```

Unwrapped:
```json
{
  "status": "success",
  "request_id": "req_...",
  "source_format": "markdown",
  "source_subtype": "md",
  "target": "docx",
  "filename": "report.docx",
  "content_type": "application/vnd...wordprocessingml.document",
  "encoding": "base64",
  "size_bytes": 8213,
  "content": "UEsDBBQ..."
}
```

**`encoding` is load-bearing.** `base64` for the six ZIP container targets
(docx, pptx, xlsx, odt, odp, ods), `utf8` for the three text targets (html, md,
qmd). Branch on the field, never on the target — decoding a utf8 payload as
base64 yields silent garbage.

**Metering:** one request per conversion, on the same counters and key gate as
`/parse`, plus the AI sub-quota when the *source* format needs AI (PDF, images).
Output size does not affect the charge.

Note: AI generation from a prompt (`--generate` / `--prompt`) is a local CLI
feature and is **not** exposed here. This endpoint is deterministic conversion
only.

## POST /api/v1/estimate

Estimate cost and latency before parsing.

**Request:**
```json
{
  "filepath": "report.docx",
  "outputFormat": "blocks"
}
```

**Response:**
```json
{
  "estimated_credits": 1,
  "format": "docx",
  "strategy": "deterministic",
  "ai_required": false,
  "estimated_ms": 15
}
```

## GET /api/v1/capabilities

Full machine-readable service contract. Returns endpoints, schemas, auth requirements, cost metadata, determinism flags, and golden examples.

## GET /api/v1/samples

Test files with stable IDs. Use these to verify integration.

```json
{
  "samples": [
    {"id": "sample_docx_basic", "format": "docx", "path": "data/test_files/sample.docx"},
    {"id": "sample_pdf", "format": "pdf", "path": "data/test_files/simple_text.pdf"}
  ]
}
```

## GET /api/v1/formats

Lists all supported input and output formats.

## GET /api/v1/pricing

Machine-readable pricing tiers and credit costs.

## GET /api/v1/tools

Tool definitions for Claude, OpenAI, and MCP integration.

## POST /general/v0/general

Unstructured.io API drop-in replacement. Returns element JSON in Unstructured format.

```json
{"args": ["data/test_files/sample.docx", "auto"]}
```

## POST /api/v1/auth/device

Request device authorization code (RFC 8628). For headless agents.

```json
{"args": ["my-agent-label", "parse"]}
```

Companion endpoints: `POST /api/v1/auth/device/poll` (poll after starting the flow), `POST /api/v1/auth/device/inspect` (check a flow's status) and `POST /api/v1/auth/device/approve` (approve from the dashboard).

## POST /api/v1/upload/url

Request a pre-authenticated GCS upload URL. **Business tier only** — bypasses the 32MB hosted request limit. Request `{"filename": "big.pdf", "mimeType": "application/pdf", "apiKey": "dp_..."}`, PUT the file bytes to the returned URL, then pass the returned `gcs_ref` to `POST /api/v1/parse`.

## API Keys

| Endpoint | Purpose |
|----------|---------|
| `POST /api/v1/keys/list` | List your keys with per-key usage (`mcpAccount action:"keys"` delegates here) |
| `POST /api/v1/keys/usage` | Usage counters for your keys |
| `POST /api/v1/keys/revoke` | Revoke a key |
| `POST /api/v1/keys/rotate` | Rotate a key |

## Request Replay & History (v0.9.0+)

| Endpoint | Purpose |
|----------|---------|
| `POST /api/v1/requests/history` | List your past requests |
| `POST /api/v1/requests/replay` | Replay a previous request by id |

Every response's `meta.request_id` (see the envelope) is the replay key;
`mcpParse`'s `requestId` parameter is reserved for this.

## Error Response Format (v0.9.0)

```json
{
  "error": {
    "code": "INPUT_NOT_FOUND",
    "message": "File not found: nonexistent.docx",
    "retryable": false,
    "suggested_fix": "Check the file path or use GET /api/v1/samples for available test files"
  }
}
```
