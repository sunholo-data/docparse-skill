# DocParse API Reference

## Base URL

```
https://ailang-dev-docparse-api-ejjw6zt3bq-ew.a.run.app
```

## Authentication

All data endpoints require an API key passed via `x-api-key` header.

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
  "output_format": "blocks"
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
| output_format | string | no | `blocks` (default), `markdown`, `html`, `a2ui` |

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

## POST /api/v1/estimate

Estimate cost and latency before parsing.

**Request:**
```json
{
  "filepath": "report.docx",
  "output_format": "blocks"
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
