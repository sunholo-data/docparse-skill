# DocParse API Reference

## Base URL

```
https://docparse.ailang.sunholo.com
```

## Authentication

Parse, convert and edit need a `dp_` API key: send it as an `X-API-Key` or
`Authorization: Bearer` header (preferred — it stays out of logs and prompts), or
as an `apiKey` body field. MCP clients on `/mcp/connect/` sign in with OAuth
instead and never handle the key.

Key format: `dp_` followed by 32 hex characters (e.g., `dp_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6`).

Discovery endpoints (health, formats, capabilities, samples, pricing, tools) and
`/api/v1/estimate` are unauthenticated.

**The API never reads a path on your disk.** `filepath` is either a multipart
upload (`-F "filepath=@report.docx"`) or a `sample_…` id from
`/api/v1/samples`. A local path sent as JSON returns `INPUT_NOT_FOUND`.

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

**Request (upload a local file — the usual case):**
```bash
curl -X POST https://docparse.ailang.sunholo.com/api/v1/parse \
  -H "X-API-Key: $DOCPARSE_API_KEY" \
  -F "filepath=@report.docx" -F "outputFormat=blocks"
```

**Request (a sample, or a public/signed URL):**
```bash
curl -X POST https://docparse.ailang.sunholo.com/api/v1/parse \
  -H "X-API-Key: $DOCPARSE_API_KEY" -H "Content-Type: application/json" \
  -d '{"filepath": "sample_docx_formatting", "outputFormat": "blocks"}'
# or: -d '{"sourceUrl": "https://example.com/report.pdf"}'
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| filepath | string | one input | Multipart upload, or a `sample_…` id |
| sourceUrl | string | one input | `https://` URL fetched by the server |
| gcsRef | string | one input | `gs://` ref from `/api/v1/upload/url` (Business tier) |
| outputFormat | string | no | `blocks` (default), `markdown`, `html`, `a2ui` |
| pdfBackend | string | no | `""` (server default, `pdftotext`), `pdftotext`, `ai`; `docling`/`liteparse` exist but the hosted 30s cap makes them unusable |
| apiKey | string | if no header | `dp_` key, when not sent as a header |

**Response (`blocks`, unwrapped)** — abridged from a real `sample_docx_formatting` parse:

```json
{
  "status": "success",
  "filename": "challenge_formatting.docx",
  "format": "docx",
  "blocks": [
    {"type": "heading", "level": 1, "text": "Scientific Paper: Gene Expression Analysis"},
    {"type": "text", "text": "The gene BRCA1 ...", "style": "Normal", "level": 0,
     "runs": [{"text": "The gene "}, {"text": "BRCA1", "bold": true, "italic": true}]}
  ],
  "metadata": {"title": "", "author": "python-docx", "created": "2013-12-23T23:15:00Z",
               "modified": "2013-12-23T23:15:00Z", "pageCount": 0},
  "summary": {},
  "warnings": []
}
```

Other block types: `table`, `list`, `image`, `section`, `change` (tracked
insertion/deletion), `comment`, `link`, `audio`, `video`.

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

No API key needed.

**Request:**
```bash
curl -X POST https://docparse.ailang.sunholo.com/api/v1/estimate \
  -F "filepath=@report.docx" -F "outputFormat=blocks"
# or JSON with a sample id: -d '{"filepath": "sample_pdf", "outputFormat": "blocks"}'
```

**Response** (returned as-is, not in the `result` envelope):
```json
{
  "format": "zip-office",
  "extension": "docx",
  "strategy": "deterministic",
  "ai_required": false,
  "counts_as_ai_request": false,
  "estimated_ms": 15,
  "note": "This format is parsed deterministically with zero AI cost."
}
```

## GET /api/v1/capabilities

Full machine-readable service contract. Returns endpoints, schemas, auth requirements, cost metadata, determinism flags, and golden examples.

## GET /api/v1/samples

Test files with stable IDs. Use these to verify integration.

26 samples, e.g. `sample_docx_formatting`, `sample_docx_tables`,
`sample_docx_track_changes`, `sample_pptx_notes`, `sample_xlsx_merged`,
`sample_markdown`, `sample_pdf`. Each entry carries `id`, `label`, `media_type`,
`tags`, `expected_formats` and `ai_required`; pass the `id` as `filepath`.

## GET /api/v1/formats

Lists all supported input and output formats.

## GET /api/v1/pricing

Machine-readable pricing tiers: monthly request and AI-request limits, file-size limits, and which formats count as AI.

## GET /api/v1/tools

Tool definitions for Claude, OpenAI, and MCP integration.

## POST /general/v0/general

Unstructured.io API drop-in replacement. Returns element JSON in Unstructured format.
Takes the key in Unstructured's `unstructured-api-key` header (or `X-API-Key`).

```bash
curl -X POST https://docparse.ailang.sunholo.com/general/v0/general \
  -H "unstructured-api-key: $DOCPARSE_API_KEY" -F "filepath=@report.docx"
```

## POST /api/v1/auth/device

Request device authorization code (RFC 8628). For headless agents and scripts
(`scripts/device-auth.sh` wraps the whole flow).

```json
{"label": "my-agent-label", "scope": "parse"}
```

Companion endpoints: `POST /api/v1/auth/device/poll` (poll after starting the flow), `POST /api/v1/auth/device/inspect` (check a flow's status) and `POST /api/v1/auth/device/approve` (approve from the dashboard).

## POST /api/v1/upload/url

Request a pre-authenticated GCS upload URL. **Business tier only** — bypasses the 32MB hosted request limit. Request `{"filename": "big.pdf", "mimeType": "application/pdf"}` with the key in a header, PUT the file bytes to the returned URL, then pass the returned `gcs_ref` as `gcsRef` to `POST /api/v1/parse`.

## POST /api/v1/edit

Parse an Office document, apply a JSON array of edit deltas, and return the
modified blocks (`filepath` as a multipart upload, `deltas` as a JSON string;
`""` round-trips). Office formats only. The MCP tool `editDocument` calls this.

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
| `POST /api/v1/requests/delete` | Delete one stored request, or all |
| `POST /api/v1/account/history` | Read or change whether requests are stored for replay |

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
