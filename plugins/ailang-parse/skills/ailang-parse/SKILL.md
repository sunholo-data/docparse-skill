---
name: ailang-parse
description: Parse documents with the AILANG Parse API. Use when user asks to parse, extract, or convert documents (DOCX, PDF, PPTX, XLSX, CSV, HTML, Markdown, EPUB, EML, images, audio, video). Also use when user mentions AILANG Parse, document parsing, unstructured data extraction, or needs to work with Office files programmatically. Triggers on "parse this file", "extract text from", "convert document", "AILANG Parse", or any document format processing task.
---

# AILANG Parse — Universal Document Parsing

Parse any document into structured blocks via the AILANG Parse API. 17 input formats, 9 output formats, one consistent schema.

## MCP Tools (Preferred)

This plugin registers an MCP server at `https://docparse.ailang.sunholo.com/mcp/`. The following tools are available automatically:

| Tool | Purpose |
|------|---------|
| `mcpParse` | Parse any document into blocks, Markdown, or HTML |
| `mcpConvert` | Convert between 17 input and 9 output formats |
| `mcpFormats` | Discover formats, 26 samples, pricing tiers, capabilities |
| `mcpEstimate` | Predict cost/latency before parsing |
| `mcpAuth` | Start device auth to get an API key (RFC 8628) |
| `mcpAuthPoll` | Poll for auth completion |
| `mcpAccount` | View tier, quota, usage, pricing, history |
| `submit_feedback` | Report a bug / feature / docs gap to the maintainers |

**Passing parameters**: every MCP tool string parameter is *required*. If you don't have a value yet — e.g. no API key, or no `requestId` — pass an **empty string `""`**; never omit it. Omitting a declared parameter returns `missing required parameter(s): ...`.

**Recommended workflow**: Call `mcpFormats` first to discover capabilities, then `mcpEstimate` to check cost, then `mcpParse` to parse.

**First run / no API key**: call `mcpParse` with `apiKey=""` **and** `requestId=""` (both empty strings). The server replies `AUTH_REQUIRED` with a `suggested_fix` to call `mcpAuth` — run that device flow, then retry `mcpParse` with the returned key. (Omitting `apiKey`/`requestId` instead returns a generic `missing required parameter(s)` error, not the auth prompt.)

## Shell Scripts (Fallback)

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
- User asks about AILANG Parse API endpoints or capabilities
- User needs Unstructured.io API compatibility
- User wants to estimate parsing costs or check quota

## API Base URLs

| Environment | URL |
|-------------|-----|
| **Production** | `https://docparse.ailang.sunholo.com` |
| Test | `https://ailang-test-docparse-api-rrmdhcxo4a-ew.a.run.app` |
| Dev | `https://ailang-dev-docparse-api-ejjw6zt3bq-ew.a.run.app` |

Default: production. Set `DOCPARSE_URL` env var to override.

## Authentication

API key with `dp_` prefix. Pass as `apiKey` in the JSON body, or set `DOCPARSE_API_KEY` env var for skill scripts.

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
  -d "{\"filepath\":\"report.docx\",\"outputFormat\":\"blocks\",\"apiKey\":\"$DOCPARSE_API_KEY\"}"
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

## Deployment & Release

DocParse uses a three-environment pipeline managed from the `ailang-multivac` repo:

```
Push to main  →  Dev  (automatic, per-push)
Tag v*        →  Test (automatic, versioned images)
Promote       →  Prod (manual, exact image copy — no rebuild)
```

| Action | Command (from ailang-multivac repo) |
|--------|-------------------------------------|
| Check status | `scripts/release.sh status` |
| Tag for test | `scripts/release.sh tag docparse v0.9.0` |
| Promote to prod | `scripts/release.sh promote docparse` |
| Monitor builds | `gcloud builds list --project=ailang-multivac-deploy --region=europe-west3 --limit=5` |

### Verify after deploy

```bash
# Test environment
curl https://ailang-test-docparse-api-rrmdhcxo4a-ew.a.run.app/api/v1/health

# Production
curl https://docparse.ailang.sunholo.com/api/v1/health
curl https://docparse.ailang.sunholo.com/api/v1/capabilities | jq .base_url
```

### GCP Projects

| Env | Project | Prefix |
|-----|---------|--------|
| Dev | `ailang-multivac-dev` | `ailang-dev` |
| Test | `ailang-multivac-test` | `ailang-test` |
| Prod | `ailang-multivac` | `ailang` |

Cloud Build triggers live in `ailang-multivac-deploy` (europe-west3).

## Reporting Issues & Feedback

Hit a bug, a missing format, or a docs gap? Use the `submit_feedback` MCP tool
with `package="sunholo/ailang_parse"` so it routes straight to the AILANG Parse
maintainers — no need to leave the session to open a GitHub issue.

- **Required**: `title`, `body`, `category` (`bug` | `feature` | `docs` | `limitation`), `ailang_version`.
- **Optional**: `snippet` (≤4 KB repro/log), `contact` (free-form, for follow-up).
- **Example**: `submit_feedback(title="PPTX speaker notes dropped", body="...", category="bug", ailang_version="0.9.0", package="sunholo/ailang_parse")`.

## Resources

- [API Reference](resources/api-reference.md) — full endpoint documentation
- [Integration Guide](resources/integration-guide.md) — Python, TypeScript, curl examples
