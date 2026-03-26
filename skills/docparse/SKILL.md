---
name: docparse
description: Parse documents with the DocParse API. Use when user asks to parse, extract, or convert documents (DOCX, PDF, PPTX, XLSX, CSV, HTML, Markdown, images, audio, video). Also use when user mentions DocParse, document parsing, unstructured data extraction, or needs to work with Office files programmatically. Triggers on "parse this file", "extract text from", "convert document", "DocParse", or any document format processing task.
---

# DocParse — Universal Document Parsing

Parse any document into structured blocks via the DocParse API. 13 input formats, 4 output formats, one consistent schema.

## Quick Start

```bash
# 1. Check connection
bash scripts/health.sh

# 2. See available test files
bash scripts/samples.sh

# 3. Parse a document
bash scripts/parse.sh data/test_files/sample.docx blocks

# 4. Estimate cost before parsing
bash scripts/estimate.sh report.pdf blocks
```

## When to Use This Skill

- User asks to parse, extract, or convert a document
- User has DOCX, PDF, PPTX, XLSX, CSV, HTML, Markdown, EPUB, ODT, ODP, ODS files
- User wants structured data from Office documents (tables, headings, track changes, comments)
- User wants to extract text from PDFs, images, audio, or video
- User asks about DocParse API endpoints or capabilities
- User needs Unstructured.io API compatibility
- User wants to estimate parsing costs or check quota

## API Base URL

```
https://ailang-dev-docparse-api-ejjw6zt3bq-ew.a.run.app
```

## Authentication

API key with `dp_` prefix. Pass via `x-api-key` header or set `DOCPARSE_API_KEY` env var.

**Get a key**: Visit https://sunholo-data.github.io/docparse/dashboard.html

**For headless agents**: Use the device authorization flow:
```bash
bash scripts/device-auth.sh
```

## Core Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/parse` | POST | Parse any document |
| `/api/v1/estimate` | POST | Check cost before parsing |
| `/api/v1/capabilities` | GET | Full service contract |
| `/api/v1/samples` | GET | Test files for verification |
| `/api/v1/formats` | GET | Supported formats |
| `/api/v1/pricing` | GET | Tier definitions + credit costs |
| `/api/v1/health` | GET | Service status |
| `/general/v0/general` | POST | Unstructured API drop-in |

## Parsing Documents

```bash
# Named JSON parameters (preferred)
curl -X POST "$DOCPARSE_URL/api/v1/parse" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $DOCPARSE_API_KEY" \
  -d '{"filepath":"report.docx","output_format":"blocks"}'
```

Output formats: `blocks` (structured JSON), `markdown`, `html`, `a2ui`

All formats return the same block types: Text, Heading, Table, Image, Audio, Video, List, Section, Change.

## Available Scripts

| Script | Usage | Purpose |
|--------|-------|---------|
| `scripts/health.sh` | `bash scripts/health.sh` | Check API health |
| `scripts/parse.sh` | `bash scripts/parse.sh <filepath> [format]` | Parse a document |
| `scripts/estimate.sh` | `bash scripts/estimate.sh <filepath> [format]` | Estimate cost |
| `scripts/samples.sh` | `bash scripts/samples.sh` | List test files |
| `scripts/capabilities.sh` | `bash scripts/capabilities.sh` | Full service contract |
| `scripts/device-auth.sh` | `bash scripts/device-auth.sh` | Get API key via device flow |

## Workflow: Parse a Document

1. **Check health**: `bash scripts/health.sh`
2. **Estimate cost**: `bash scripts/estimate.sh report.docx blocks`
3. **Parse**: `bash scripts/parse.sh report.docx blocks`
4. **Use the result**: The response contains structured blocks (JSON)

## Workflow: Verify Integration

1. **List samples**: `bash scripts/samples.sh`
2. **Parse a test file**: `bash scripts/parse.sh data/test_files/sample.docx blocks`
3. **Check the response** has `result` field with blocks array
4. **Compare** response shape to the capability manifest's golden examples

## Error Codes

| Code | Retryable | Fix |
|------|-----------|-----|
| `INPUT_NOT_FOUND` | No | Check file path, use `/api/v1/samples` for test files |
| `UNSUPPORTED_FORMAT` | No | Check `/api/v1/formats` for supported types |
| `INVALID_API_KEY` | No | Check key format (dp_ + 32 hex chars) |
| `QUOTA_EXCEEDED` | After reset | Wait for daily reset or upgrade tier |
| `AI_UNAVAILABLE` | Yes | Retry — AI backend temporarily down |
| `PARSE_FAILED` | Maybe | File may be corrupt |

All errors include `suggested_fix` — a plain-text instruction you can act on directly.

## Credit Costs

| Format | Credits |
|--------|---------|
| Office (DOCX, PPTX, XLSX, ODT, ODP, ODS) | 1 |
| Text (CSV, Markdown, HTML, EPUB) | 1 |
| PDF | 3 |
| Image (PNG, JPG, GIF, TIFF, WebP) | 3 |
| Audio (MP3, WAV) | 5 |
| Video (MP4) | 10 |

## Resources

- [API Reference](resources/api-reference.md) — full endpoint documentation
- [Integration Guide](resources/integration-guide.md) — Python, TypeScript, curl examples
