---
name: ailang-parse
description: >-
  AILANG Parse (docparse) creates Word documents from Markdown and DOCX templates,
  and parses, extracts, or converts Office files, PDFs, and other documents.
  Use for docparse or AILANG Parse requests, Word reports, document conversion,
  extracting tables or review markup, and exporting Markdown to slides,
  spreadsheets, or Quarto. Covers the local CLI and optional hosted API/MCP.
  Use specialised editing tools for precise Word redlines or live app editing.
---

# AILANG Parse — Universal Document Parsing and Generation

Two directions, one schema. **Parse** any document into structured blocks, and
**generate** documents in 9 formats. `docparse` is the CLI name for AILANG Parse.

## Tool availability and paths

This skill works in Codex and Claude. A standalone skill installation provides
instructions and scripts; it does **not** register an MCP server. Inspect the
available tools before using MCP. With no MCP connection, use the installed
`docparse` CLI; no hosted account is needed for deterministic local conversion.
Call `mcpFormats` for live hosted capabilities only when using that connection.

Resolve `scripts/` and `resources/` relative to this SKILL.md, not the user's
working directory. For shell examples, set `DOCPARSE_SKILL_DIR` to the absolute
folder containing this SKILL.md and use
`bash "$DOCPARSE_SKILL_DIR/scripts/convert.sh" ...`. The bundled shell scripts
call the **hosted API**, except `render.sh` and `audit.sh`, which are local verification wrappers.

For new local documents, prefer Markdown → `docparse --convert`; use a supplied
DOCX as `--reference-doc`. Read [Document authoring and verification](resources/document-authoring.md)
for template behaviour, output paths, visual QA, and specialised Word edits.
Follow an explicitly requested tool or workflow when it differs.

## Choose the path first: local CLI or hosted API

There are two ways to run AILANG Parse, and they run the **same parsers** —
the difference is where the document goes.

| | Local CLI (`docparse`) | Hosted API / MCP tools |
|---|---|---|
| Where the document goes | deterministic backends stay on the machine; AI backends may send content | **uploaded to the cloud service** |
| Setup | one `curl \| sh` (0.40.0+) | connected MCP server or API scripts |
| Account / quota | none | OAuth sign-in (MCP) or `dp_` key (scripts); counts against the tier |
| File size | unlimited | 10 MB Free, 25 MB Pro, 50 MB Business (over 32 MB only via Business GCS upload) |
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

- `docparse` is not installed and cannot be, and the content is not sensitive.
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

**Install** — one command, no clone (ailang_parse **0.40.0+**):

```bash
command -v docparse    # already installed?

curl -fsSL https://www.sunholo.com/ailang-parse/install.sh | sh
```

It fetches the published package (~400 KB), installs the AILANG runtime if
missing, and puts `docparse` on `PATH`. `--version`, `--prefix` and
`--uninstall` are supported; re-running is a no-op.

PDF needs two more steps, and this is the one people skip:

```bash
brew install poppler          # pdftotext, the default PDF backend
                              # (apt install poppler-utils on Debian/Ubuntu)
docparse --install-backends   # docling + liteparse, for scans and layout
```

`--install-backends` matters even if you never pass `--pdf-backend`: when
`pdftotext` finds no text layer the parser escalates to `docling` on its own, so
without it a **scanned** PDF fails on the default backend. AI backends
authenticate via `gcloud auth application-default login` (ADC), not an API key.

**If `ailang` is already on PATH** (ailang_parse **0.42.0+**, AILANG v0.40.0
dev or later), `ailang install sunholo/ailang_parse` is also a route: the
package's `[bin]` table puts a `docparse` shim in `~/.ailang/bin`. It is the
*thin* CLI — one file in, JSON/Markdown or `--convert` out, written next to
the input. It has **no** `--output-dir`, batch, `--describe`, PDF backends or
`--install-backends`, so prefer the installer above when you will need any of
those; if both are installed, `ailang install` reports which one `docparse`
resolves to. (Before 0.42.0 this route fetched the package but gave no CLI.)

Still do **not** offer these as install routes — none yields a working CLI:
the repo's Dockerfile has no published image (and pins `--caps IO,FS,Env`, so
no PDF subprocesses or AI); and the pip/npm/Go SDKs are hosted-API clients
containing no parsers. A `git clone` still works and is the contributors' path.

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
2. **Pass `--output-dir`** when you want results collected somewhere. Since
   0.42.0 the default is the directory you ran from (`./report.json` next to
   `report.docx`); before that it was `docparse/data` inside the clone, which
   read as "the output went missing".
3. **Let the local PDF backends run before reaching for `ai`.** On the default
   backend the CLI already escalates `pdftotext` → `docling` by itself when
   there is no text layer, because both are free. `ai` is never automatic — it
   costs money and sends the document to a provider, so put it to the user.
   (`liteparse` is not an OCR fallback: it reads font sizes in an existing text
   layer and fails on a scan exactly as `pdftotext` does.)

Install, the full flag list, environment variables, and the failure-mode table
are in [resources/local-cli.md](resources/local-cli.md).

## MCP Tools (the hosted path)

The plugin bundles an MCP connection to `https://docparse.ailang.sunholo.com/mcp/connect/`.
A standalone skill link does not. It signs in with **OAuth**: the first call to a
tool that needs an account makes the client (Claude, Codex, ChatGPT) open a
sign-in page; the user signs in with Google or GitHub and approves, and the
client holds the token from then on. Tools take **no `apiKey` argument** there.
When connected, discover the actual tool names and schemas; the service exposes
these capabilities:

| Tool | Purpose |
|------|---------|
| `mcpParse` | Parse any document into blocks, Markdown, HTML, or A2UI |
| `mcpConvert` | **Generate** a document — converts any input into docx, pptx, xlsx, odt, odp, ods, html, md, or qmd |
| `editDocument` | Parse a document, apply JSON edit deltas, return the modified blocks (Office formats only) |
| `getUploadUrl` | Pre-authenticated GCS upload URL for files over the 32MB hosted limit (**Business tier only**) |
| `mcpFormats` | Discover formats, samples, pricing tiers, capabilities |
| `mcpEstimate` | Predict cost/latency before parsing |
| `mcpAccount` | `action`: `status` (default — tier/quota/usage), `keys` (list keys + per-key usage), `usage` (alias for keys), `pricing` (no auth), `history` / `history_on` / `history_off` |
| `submit_feedback` | Report a bug / feature / docs gap to the maintainers |

**Passing parameters**: only the parameters marked required in a tool's schema are needed; optional ones (`requestId`, `outputPath`, `action`) can be left out.

**Recommended workflow**: Call `mcpFormats` first to discover capabilities, then `mcpEstimate` to check cost, then `mcpParse` or `mcpConvert`. `mcpFormats` and `mcpEstimate` need no sign-in.

**First run / not signed in**: just call the tool. If the client is not signed in yet, the server answers 401 and the client starts the OAuth sign-in itself; retry once the user has approved. Never ask the user to paste an API key into the chat.

**Headless agents without a browser** can use the agent surface `https://docparse.ailang.sunholo.com/mcp/` instead: same tools plus `mcpAuth` / `mcpAuthPoll` (RFC 8628 device flow), with the `dp_` key passed as `apiKey` or, better, sent as an `Authorization: Bearer` / `X-API-Key` header so it stays out of the model's context.

## Generating Documents

Before authoring, read [Writing quality](resources/writing-quality.md).
When a reference is supplied, read [Template inspection](resources/template-inspection.md).
For faithful conversion, preserve the source wording rather than applying an
editorial rewrite. Verification commands are in the authoring reference.

**Markdown is the format you can write, so it is how you generate a document.**
Write Markdown, then convert it to the target format. There is no separate
"create a DOCX" tool and none is needed.

```bash
mkdir -p ./output ./parsed
docparse report.md --convert ./output/report.docx --output-dir ./parsed
docparse report.md --convert ./output/branded.docx --output-dir ./parsed \
  --reference-doc letterhead.docx
docparse notes.md --convert ./output/slides.pptx --output-dir ./parsed
docparse data.md --convert ./output/data.xlsx --output-dir ./parsed
docparse paper.md --convert ./output/paper.qmd --output-dir ./parsed
```

For the hosted path, use
`bash "$DOCPARSE_SKILL_DIR/scripts/convert.sh" report.md docx ./output/report.docx`.
For MCP, inspect the connected `mcpConvert` schema. A hosted server cannot read
an arbitrary laptop path: use a supported upload/reference mechanism or the
multipart-upload script, and decode the returned payload into the output file.

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
These have no Markdown syntax. Supported comments and tracked changes can be
preserved when converting from a document that already contains them.
`--reference-doc` supplies headers, footers, styles, fonts, and page setup for
new DOCX content; template body text and template comments are discarded.
See the authoring reference before choosing conversion for a fidelity-sensitive edit.

**AI generation from a prompt** (`--generate report.docx --prompt "Q1 sales
report"`) exists only in the local `docparse` CLI. It is **not** on the hosted
API — `/api/v1/convert` is deterministic conversion only. If a user wants a
document authored from a prompt, write the Markdown yourself and convert it.

## Editing Documents (deltas)

`editDocument(filepath, deltas)` parses a document, applies a JSON array
of edit deltas, and returns the modified blocks — same schema as `mcpParse` with
`outputFormat="blocks"`. Pass `deltas=""` for a round-trip (parse + unchanged
blocks back).

- Only deterministic Office formats work: docx, pptx, xlsx, odt, odp, ods.
  AI-required formats (PDF, images, audio, video) are rejected.
- The tool returns blocks, not a file — use the AILANG SDK or CLI to generate a
  file from the returned blocks.

## Uploading Large Files

`getUploadUrl(filename, mimeType)` returns a pre-authenticated GCS URL
(**Business tier only**). PUT the file bytes to that URL, then pass the returned
`gcs_ref` to `mcpParse`. This bypasses the 32MB hosted request limit.

## Shell Scripts (hosted API, no MCP)

```bash
# 1. Check connection
bash scripts/health.sh

# 2. See available test files
bash scripts/samples.sh

# 3. Parse a document — a local file is uploaded; a sample_… id or https:// URL is referenced
bash scripts/parse.sh report.docx blocks
bash scripts/parse.sh sample_docx_formatting markdown

# 4. Estimate cost before parsing (no API key needed)
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

**MCP (the plugin)**: OAuth — see [MCP Tools](#mcp-tools-the-hosted-path). Nothing to configure.

**REST API and the shell scripts below**: an API key with `dp_` prefix. Pass it as `apiKey` in the JSON body or as an `X-API-Key` / `Authorization: Bearer` header, or set the `DOCPARSE_API_KEY` env var for skill scripts.

**Get a key**: https://www.sunholo.com/docparse/dashboard.html

**For headless agents** (REST/scripts): use the device authorization flow:
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
| `/api/v1/pricing` | GET | Tier definitions and limits |
| `/api/v1/health` | GET | Service status |
| `/general/v0/general` | POST | Unstructured API drop-in |

## Parsing Documents

```bash
# Upload the file — the API never reads a path on your disk (INPUT_NOT_FOUND)
curl -X POST "$DOCPARSE_URL/api/v1/parse" \
  -H "X-API-Key: $DOCPARSE_API_KEY" \
  -F "filepath=@report.docx" -F "outputFormat=blocks"
```

JSON `filepath` is only for `sample_…` ids; use `sourceUrl` for an `https://` URL.

Output formats: `blocks` (structured JSON), `markdown`, `html`, `a2ui`

All formats return the same block types: `text`, `heading`, `table`, `image`,
`audio`, `video`, `list`, `section`, `change`, `link`, `comment`.

## Converting / Generating Documents

`/api/v1/convert` takes four input modes and returns the document **inline in
JSON**, not as a binary body.

```bash
# Upload a local file (the API cannot see your disk — this is the usual path)
curl -X POST "$DOCPARSE_URL/api/v1/convert" -H "X-API-Key: $DOCPARSE_API_KEY" \
  -F "filepath=@report.md" -F "target=docx"

# Or reference a sample_id, an https:// URL (sourceUrl), or a gs:// ref (gcsRef, Business tier)
curl -X POST "$DOCPARSE_URL/api/v1/convert" -H "X-API-Key: $DOCPARSE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"filepath":"sample_docx_tables","target":"html"}'
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
| `scripts/render.sh` | `bash scripts/render.sh <file> --output-dir <new-dir> [--compare <file>]` | Local rendering and visual comparison |
| `scripts/audit.sh` | `bash scripts/audit.sh <file.docx> [--strict]` | Read-only local structural audit |
| `scripts/health.sh` | `bash scripts/health.sh` | Check API health |
| `scripts/parse.sh` | `bash scripts/parse.sh <file\|sample_id\|url> [format]` | Parse a document (local files are uploaded) |
| `scripts/convert.sh` | `bash scripts/convert.sh <input> <target> [out]` | Generate/convert a document |
| `scripts/estimate.sh` | `bash scripts/estimate.sh <file\|sample_id> [format]` | Estimate cost (no key needed) |
| `scripts/samples.sh` | `bash scripts/samples.sh` | List test files |
| `scripts/capabilities.sh` | `bash scripts/capabilities.sh` | Full service contract |
| `scripts/device-auth.sh` | `bash scripts/device-auth.sh` | Get an API key for the scripts (device flow) |

## Workflow: Parse a Document via the Hosted API

1. **Check health**: `bash scripts/health.sh`
2. **Estimate cost**: `bash scripts/estimate.sh report.docx blocks`
3. **Parse**: `bash scripts/parse.sh report.docx blocks`
4. **Use the result**: The response contains structured blocks (JSON)

## Workflow: Generate a Document

1. Write Markdown in a writable task directory, with front matter, headings,
   tables, and image paths as needed. Preserve the user's content and template.
2. Create the output directory and convert locally with an explicit filename:
   `docparse draft.md --convert ./output/report.docx --output-dir ./parsed`.
   Add `--reference-doc template.docx` when a reference is supplied.
   Use the hosted conversion script only when that path was selected.
3. Parse the output back locally into a separate verification directory and
   check headings, tables, images, and supported review markup as applicable.
4. Render the latest document and inspect every page for layout defects. Fix,
   regenerate, and recheck after layout changes. Structural parsing alone does
   not verify appearance. Follow [Document authoring and verification](resources/document-authoring.md).
5. Deliver the requested file and disclose any verification that could not be
   completed. Keep QA images and intermediate files separate from deliverables.

## Workflow: Verify Integration

1. **List samples**: `bash scripts/samples.sh`
2. **Parse a test file**: `bash scripts/parse.sh sample_docx_formatting blocks`
3. **Check the response** has `"status": "success"` and a `blocks` array (the script unwraps the `result` envelope)
4. **Compare** response shape to the capability manifest's golden examples

## Error Codes

| Code | Retryable | Fix |
|------|-----------|-----|
| `INPUT_NOT_FOUND` | No | Check file path, use `/api/v1/samples` for test files |
| `UNSUPPORTED_FORMAT` | No | Check `/api/v1/formats` for supported types |
| `UNSUPPORTED_TARGET_FORMAT` | No | Convert target must be one of html md qmd docx pptx xlsx odt odp ods |
| `INVALID_API_KEY` | No | Check key format (dp_ + 32 hex chars), or that it was not revoked |
| `QUOTA_EXCEEDED` | After reset | Wait for daily reset or upgrade tier |
| `FILE_TOO_LARGE` | No | Over the tier's size limit — use the local CLI, or Business GCS upload |
| `WORKBOOK_TOO_COMPLEX` | No | XLSX over 250,000 cells or 1,000 merged ranges — split by sheet |
| `TIER_UPGRADE_REQUIRED` | No | Feature needs a higher tier (e.g. GCS upload is Business) |
| `AI_UNAVAILABLE` / `AI_PROVIDER_ERROR` | Yes | Retry — AI backend temporarily down |
| `PDF_BACKEND_FAILED` | No | The chosen PDF backend failed; try another, or the local CLI |
| `PARSE_FAILED` | Maybe | File may be corrupt |

On `/mcp/connect/`, a missing or expired sign-in is an HTTP 401, which the
client answers by starting OAuth — not an error code you handle.

All errors include `suggested_fix` — a plain-text instruction you can act on directly.

## Metering

Every parse and every conversion counts as **one request** against the tier's
monthly allowance, whatever the page count or output size. Formats the service
classes as AI (PDF and images: PNG, JPG, GIF, BMP, WebP, TIFF) also count as
**one AI request** against the smaller AI allowance. `mcpEstimate` /
`/api/v1/estimate` tells you which applies (`counts_as_ai_request`) before you
spend anything; `mcpFormats` / `/api/v1/pricing` has the live limits.

| Tier | Price | Requests / month | AI requests / month | Max file |
|------|-------|------------------|---------------------|----------|
| Free | €0 | 1,000 | 50 | 10 MB |
| Pro | €29 | 100,000 | 500 | 25 MB |
| Business | €99 | 500,000 | 2,000 | 50 MB |

Audio and video (WAV, MP3, MP4, …) are **self-host only**: the hosted API does
not parse them.

## Reporting Issues & Feedback

When the user authorizes sending a bug report or feature request, use the available `submit_feedback` MCP tool
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
