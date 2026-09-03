---
name: ailang-parse
description: Parse AND generate documents with the AILANG Parse API. Use when the user asks to parse, extract, read, or convert documents (DOCX, PDF, PPTX, XLSX, ODT, ODP, ODS, CSV, HTML, Markdown, EPUB, EML, TEX, RTF, images, audio, video) — and equally when they ask to CREATE, generate, write, author, build, or make a document, deck, spreadsheet, or report in any Office format. Triggers on "parse this file", "extract text from", "convert document", "turn these notes into a PowerPoint", "make me a Word doc", "write this up as a docx", "generate a spreadsheet", "build a report", "export this as Quarto", or any document format processing task. Covers BOTH the hosted API/MCP path and the local `docparse` CLI, which parses locally and uploads nothing — use the local path when documents are confidential, restricted, or must not leave the machine, when the user says "don't upload this" or "run it locally", for files over 32MB, for audio/video, or when a slow local PDF backend (docling, liteparse) is needed.
---

# AILANG Parse — Universal Document Parsing and Generation

Two directions, one schema. **Parse** any document into structured blocks, and
**generate** documents in 9 formats. Call `mcpFormats` for the live list of what
is supported — it is the service's own answer and never goes stale.

## Choose the path first: local CLI or hosted API

There are two ways to run AILANG Parse, and they run the **same parsers** —
the difference is where the document goes.

| | Local CLI (`docparse`) | Hosted API / MCP tools |
|---|---|---|
| Where the document goes | stays on the machine | **uploaded to the cloud service** |
| Setup | clone + AILANG runtime | none — the plugin's MCP server |
| API key / quota | none | `dp_` key, counts against tier |
| File size | unlimited | 32MB (Business tier can pre-upload to GCS) |
| Audio / video | supported | **rejected** — self-host only |
| Slow PDF backends (`docling`, `liteparse`) | up to 20 min | unusable — hard 30s cap |
| AI generation from a prompt | `--generate` | not available |
| Output of a conversion | a real file on disk | base64/utf8 inside JSON |

**Decide before the first call, and say which path you are using.** Users have
been surprised to find an MCP parse had uploaded a document.

Use the **local CLI** when any of these is true:

- The material is confidential, restricted, client-privileged, under NDA, or the
  user has said anything like "don't upload this" / "keep it local" / "run it
  offline". **When in doubt, ask — do not upload by default.**
- The file is over 32MB, or is audio/video.
- The PDF needs `docling` or `liteparse` (the hosted 30s cap kills both).
- The user wants a document AI-generated from a prompt (`--generate`).
- There is a folder of files to batch, or no network.

Use the **hosted API / MCP tools** when:

- `docparse` is not installed and the content is not sensitive.
- You want zero setup, or need `mcpEstimate` / `mcpAccount` / quota data.
- The caller is a remote agent with no shell.

The two coexist fine. See [Local CLI reference](resources/local-cli.md) for
install, flags, and exactly which invocations touch the network.

**One caveat that decides real cases:** "local" is a property of the *backend*,
not of the CLI. Deterministic paths (Office, ODF, text, HTML, EPUB, email, and
PDF via `pdftotext`/`docling`/`liteparse`) never touch the network. But
`--pdf-backend ai`, `--describe`, `--summarize`, images, and audio/video all
send content to the AI provider. Running locally does not by itself keep a
scanned PDF off the wire.

## Local CLI Quick Reference

**Install** (two binaries: the wrapper needs the AILANG runtime on `PATH`):

```bash
command -v docparse && command -v ailang    # already installed?

curl -fsSL https://ailang.sunholo.com/install.sh | bash      # 1. AILANG runtime
git clone https://github.com/sunholo-data/ailang-parse.git   # 2. the parsers
ln -s "$PWD/ailang-parse/bin/docparse" /usr/local/bin/docparse
docparse --check                                             # 3. verify
```

That covers every deterministic format. PDF needs more, and this is the step
people skip:

```bash
brew install poppler          # pdftotext — the default PDF backend
                              # (apt install poppler-utils on Debian/Ubuntu)

cd ailang-parse && uv pip install docling liteparse   # local OCR / layout
```

`docling` and `liteparse` are Python packages inside the **clone's own uv
environment**, not system tools, and they are not in the default dependency
group — installing `uv` alone is not enough. This matters even if you never
pass `--pdf-backend`: when `pdftotext` finds no text layer the CLI escalates to
`docling` automatically, and without it a scanned PDF fails with
`no text layer … and OCR found nothing`, which reads like a corrupt file rather
than a missing dependency. AI backends authenticate via
`gcloud auth application-default login` (ADC), not an API key.

**Use**

```bash
docparse report.docx                       # -> <out>/report.json + .md
docparse ~/case-files/ --output-dir /tmp/parsed   # batch a folder; compiles ONCE
docparse contract.pdf                      # deterministic pdftotext, no AI, no network
docparse contract.pdf --pdf-backend docling       # local ML layout; slow, allowed 20m
docparse notes.md --convert slides.pptx    # writes a real file, not base64 JSON
docparse notes.md --convert offer.docx --reference-doc letterhead.docx
docparse --generate report.docx --prompt "Q1 sales report"   # CLI-only
```

Three things that bite:

1. **Batch, never loop.** `docparse *.docx` compiles once;
   `for f in *.docx; do docparse "$f"; done` recompiles per file and is ~10x slower.
2. **Pass `--output-dir`.** The default output lands in `docparse/data` inside
   the clone, which reads as "the output went missing".
3. **Try local PDF backends before `ai`.** `pdftotext` → `docling` → `liteparse`
   → `ai`. Only a scanned/image-only PDF genuinely needs `ai`, and that decision
   sends the document to an AI provider — put it to the user first.

Install, the full flag list, environment variables, and the failure-mode table
are in [resources/local-cli.md](resources/local-cli.md).

## MCP Tools (Preferred)

This plugin registers an MCP server at `https://docparse.ailang.sunholo.com/mcp/`. The following tools are available automatically:

| Tool | Purpose |
|------|---------|
| `mcpParse` | Parse any document into blocks, Markdown, HTML, or A2UI |
| `mcpConvert` | **Generate** a document — converts any input into docx, pptx, xlsx, odt, odp, ods, html, md, or qmd |
| `editDocument` | Parse a document, apply JSON edit deltas, return the modified blocks (Office formats only) |
| `getUploadUrl` | Pre-authenticated GCS upload URL for files over the 32MB hosted limit (**Business tier only**) |
| `mcpFormats` | Discover formats, samples, pricing tiers, capabilities |
| `mcpEstimate` | Predict cost/latency before parsing |
| `mcpAuth` | Start device auth to get an API key (RFC 8628) |
| `mcpAuthPoll` | Poll for auth completion |
| `mcpAccount` | `action`: `status` (default — tier/quota/usage), `keys` (list keys + per-key usage), `usage` (alias for keys), `pricing` (no auth) |
| `submit_feedback` | Report a bug / feature / docs gap to the maintainers |

**Passing parameters**: every MCP tool string parameter is *required*. If you don't have a value yet — e.g. no API key, or no `requestId` — pass an **empty string `""`**; never omit it. Omitting a declared parameter returns `missing required parameter(s): ...`.

**Recommended workflow**: Call `mcpFormats` first to discover capabilities, then `mcpEstimate` to check cost, then `mcpParse` or `mcpConvert`.

**First run / no API key**: call `mcpParse` with `apiKey=""` **and** `requestId=""` (both empty strings). The server replies `AUTH_REQUIRED` with a `suggested_fix` to call `mcpAuth` — run that device flow, then retry `mcpParse` with the returned key. (Omitting `apiKey`/`requestId` instead returns a generic `missing required parameter(s)` error, not the auth prompt.)

## Generating Documents

**Markdown is the format you can write, so it is how you generate a document.**
Write Markdown, then convert it to the target format. There is no separate
"create a DOCX" tool and none is needed.

```bash
# Write your content to a .md file, then:
bash scripts/convert.sh report.md docx
bash scripts/convert.sh notes.md pptx      # each H1/H2 becomes a slide
bash scripts/convert.sh data.md xlsx
bash scripts/convert.sh paper.md qmd       # Quarto
```

Or over MCP: `mcpConvert(input: "report.md", outputFormat: "docx", apiKey: ...)`.

**What survives Markdown → any output format:**

| Feature | Notes |
|---|---|
| YAML front matter | `title:` / `author:` / `date:` become document properties |
| `**bold**` `*italic*` `` `code` `` `~~strike~~` | real character formatting, not literal asterisks |
| `[links](url)` | real hyperlinks |
| `![images](path.png)` | local paths are read and embedded |
| Fenced code blocks | preserved as code |
| Blockquotes, nested lists, thematic breaks | preserved |
| Tables | including column alignment and colspan |

**What Markdown cannot express** — headers, footers, comments, tracked changes.
These have no Markdown syntax. They survive only when you convert *from* a
document that already contains them (e.g. DOCX → DOCX). Do not promise a user a
generated document with a running header; tell them it needs a source document
or a template.

**AI generation from a prompt** (`--generate report.docx --prompt "Q1 sales
report"`) exists only in the local `docparse` CLI. It is **not** on the hosted
API — `/api/v1/convert` is deterministic conversion only. If a user wants a
document authored from a prompt, write the Markdown yourself and convert it.

## Editing Documents (deltas)

`editDocument(filepath, deltas, apiKey)` parses a document, applies a JSON array
of edit deltas, and returns the modified blocks — same schema as `mcpParse` with
`outputFormat="blocks"`. Pass `deltas=""` for a round-trip (parse + unchanged
blocks back).

- Only deterministic Office formats work: docx, pptx, xlsx, odt, odp, ods.
  AI-required formats (PDF, images, audio, video) are rejected.
- The tool returns blocks, not a file — use the AILANG SDK or CLI to generate a
  file from the returned blocks.

## Uploading Large Files

`getUploadUrl(filename, mimeType, apiKey)` returns a pre-authenticated GCS URL
(**Business tier only**). PUT the file bytes to that URL, then pass the returned
`gcs_ref` to `mcpParse`. This bypasses the 32MB hosted request limit.

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

# 5. Generate/convert a document
bash scripts/convert.sh report.md docx
```

## When to Use This Skill

**Parsing:**
- User asks to parse, extract, read, or convert a document
- User has DOCX, PDF, PPTX, XLSX, CSV, HTML, Markdown, EPUB, ODT, ODP, ODS, EML, TEX, RTF files
- User wants structured data from Office documents (tables, headings, track changes, comments)
- User wants to extract text from PDFs or images
- User has audio/video to parse — **local CLI only**: the hosted API rejects it (see [resources/local-cli.md](resources/local-cli.md))

**Generating:**
- User asks to create, write, author, build, or make a document, deck, or spreadsheet
- User says "turn this into a PowerPoint", "give me this as a Word doc", "export as Excel"
- User wants a report, summary, or analysis delivered as a real Office file rather than chat text
- User wants Quarto (`.qmd`) output for a reproducible document

**Either:**
- User asks about AILANG Parse API endpoints or capabilities
- User needs Unstructured.io API compatibility
- User wants to estimate parsing costs or check quota

## API Base URL

```
https://docparse.ailang.sunholo.com
```

Set the `DOCPARSE_URL` env var to point the scripts at a different deployment.

## Authentication

API key with `dp_` prefix. Pass as `apiKey` in the JSON body, or set `DOCPARSE_API_KEY` env var for skill scripts.

**Get a key**: https://www.sunholo.com/docparse/dashboard.html

**For headless agents**: Use the device authorization flow:
```bash
bash scripts/device-auth.sh
```

## Core Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/parse` | POST | Parse any document |
| `/api/v1/convert` | POST | Generate a document in a target format |
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

All formats return the same block types: Text, Heading, Table, Image, Audio,
Video, List, Section, Change, Link, Comment.

## Converting / Generating Documents

`/api/v1/convert` takes four input modes and returns the document **inline in
JSON**, not as a binary body.

```bash
# Upload a local file (the API cannot see your disk — this is the usual path)
curl -X POST "$DOCPARSE_URL/api/v1/convert" \
  -F "filepath=@report.md" -F "target=docx" -F "apiKey=$DOCPARSE_API_KEY"

# Or reference a sample_id, an https:// URL, or a gs:// ref (Business tier)
curl -X POST "$DOCPARSE_URL/api/v1/convert" \
  -H "Content-Type: application/json" \
  -d "{\"filepath\":\"sample_docx_tables\",\"target\":\"html\",\"apiKey\":\"$DOCPARSE_API_KEY\"}"
```

Response — inside the serve-api envelope, like `/api/v1/parse`. Unwrap `result`
(a JSON-encoded string) first:

```json
{"result": "{\"status\":\"success\", ...}"}
```

Unwrapped:

```json
{"status": "success", "target": "docx", "filename": "report.docx",
 "content_type": "application/vnd...wordprocessingml.document",
 "encoding": "base64", "size_bytes": 8213, "content": "UEsDBBQ..."}
```

**`encoding` is load-bearing.** It is `base64` for the six ZIP container targets
(docx, pptx, xlsx, odt, odp, ods) and `utf8` for the three text targets (html,
md, qmd). Branch on the `encoding` field, never on the target — decoding a utf8
payload as base64 produces silent garbage. `scripts/convert.sh` does this
correctly; copy its logic rather than rewriting it.

Targets are normalised server-side: `.docx`, `DOCX`, `markdown` and `htm` all
work. Anything unrecognised is a typed `UNSUPPORTED_TARGET_FORMAT` error.

## Available Scripts

| Script | Usage | Purpose |
|--------|-------|---------|
| `scripts/health.sh` | `bash scripts/health.sh` | Check API health |
| `scripts/parse.sh` | `bash scripts/parse.sh <filepath> [format]` | Parse a document |
| `scripts/convert.sh` | `bash scripts/convert.sh <input> <target> [out]` | Generate/convert a document |
| `scripts/estimate.sh` | `bash scripts/estimate.sh <filepath> [format]` | Estimate cost |
| `scripts/samples.sh` | `bash scripts/samples.sh` | List test files |
| `scripts/capabilities.sh` | `bash scripts/capabilities.sh` | Full service contract |
| `scripts/device-auth.sh` | `bash scripts/device-auth.sh` | Get API key via device flow |

## Workflow: Parse a Document

1. **Check health**: `bash scripts/health.sh`
2. **Estimate cost**: `bash scripts/estimate.sh report.docx blocks`
3. **Parse**: `bash scripts/parse.sh report.docx blocks`
4. **Use the result**: The response contains structured blocks (JSON)

## Workflow: Generate a Document

1. **Write the content as Markdown** — front matter for title/author, tables,
   headings, lists, code fences all carry through
2. **Convert**: `bash scripts/convert.sh draft.md docx`
3. **Verify**: the script prints the output path, MIME type and byte size. For
   anything structural (tables, merged cells), parse it back with
   `bash scripts/parse.sh out.docx blocks` and check the structure survived —
   "the file opens" is not the same as "the file is correct"

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
| `UNSUPPORTED_TARGET_FORMAT` | No | Convert target must be one of html md qmd docx pptx xlsx odt odp ods |
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

Audio and video formats (WAV, MP3, MP4, …) are **self-host only** — the hosted
API does not parse them, so they carry no hosted credit cost.

Conversion is charged **per generated document**, on the same counters as parse
— the cost is driven by the *source* format above, and output size does not
affect it. Converting a 1-page Markdown file to DOCX costs the same as
converting a 200-page one.

## Reporting Issues & Feedback

Hit a bug, a missing format, or a docs gap? Use the `submit_feedback` MCP tool
with `package="sunholo/ailang_parse"` so it routes straight to the AILANG Parse
maintainers — no need to leave the session to open a GitHub issue.

- **Required**: `title`, `body`, `category` (`bug` | `feature` | `docs` | `limitation`), `ailang_version`.
- **Optional**: `snippet` (≤4 KB repro/log), `contact` (free-form, for follow-up).
- **Example**: `submit_feedback(title="PPTX speaker notes dropped", body="...", category="bug", ailang_version="0.9.0", package="sunholo/ailang_parse")`.

## Resources

- [Local CLI reference](resources/local-cli.md) — install, flags, and what leaves the machine
- [API Reference](resources/api-reference.md) — full endpoint documentation
- [Integration Guide](resources/integration-guide.md) — Python, TypeScript, curl examples
- [Docs](https://www.sunholo.com/ailang-parse/) · [MCP guide](https://www.sunholo.com/ailang-parse/mcp.html) · [Pricing](https://www.sunholo.com/ailang-parse/pricing.html)
