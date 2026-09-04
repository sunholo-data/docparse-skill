# AILANG Parse — Agent Guidelines

This repository is a plugin for AI coding assistants that provides universal document parsing via the AILANG Parse API.

> **pi users:** pi does not load MCP servers. The `pi-extension/` directory in
> this repo is the pi-native equivalent — native tools wrapping the local CLI
> and the hosted REST API, with shared device-flow auth. See
> `pi-extension/README.md`.

## What This Plugin Does

When installed, it registers an MCP server at `https://docparse.ailang.sunholo.com/mcp/` with 10 tools for document parsing, editing, generation, format conversion, cost estimation, authentication, file upload, and account management.

## Choose the path before the first call

The MCP tools are the **hosted** service: the document is uploaded. The local
`docparse` CLI runs the same parsers on the machine, uploading nothing. Tell the
user which one you are about to use.

Use the local CLI when the material is confidential, restricted, or the user
asked to keep it offline; for files over 32MB; for audio/video; when a PDF needs
the `docling`/`liteparse` backends (the hosted API's 30s cap kills them); or for
`--generate` (prompt-to-document, hosted has no equivalent). When in doubt about
sensitivity, ask — do not upload by default.

```bash
# Install. Source install only — no binary, no brew, no published image.
# The wrapper runs AILANG source relative to its own path, so the clone IS the
# install; put it somewhere permanent. It also needs `ailang` on PATH.
curl -fsSL https://ailang.sunholo.com/install.sh | bash
git clone https://github.com/sunholo-data/ailang-parse.git ~/.local/share/ailang-parse
ln -s ~/.local/share/ailang-parse/bin/docparse ~/.local/bin/docparse
docparse --check

# PDF only: pdftotext is the default backend; docling/liteparse are Python
# packages in the clone's uv env, NOT in the default dependency group.
# Without docling, a scanned PDF fails even on the default backend.
brew install poppler                                  # apt: poppler-utils
cd ailang-parse && uv pip install docling liteparse
# AI backends authenticate via ADC: gcloud auth application-default login

docparse report.docx --output-dir ./parsed
docparse ~/inbox/ --output-dir ./parsed        # batch: compiles once, ~10x faster than a loop
docparse notes.md --convert slides.pptx
```

Note that "local" is a property of the backend: deterministic formats and
`pdftotext`/`docling`/`liteparse` PDFs never touch the network, but
`--pdf-backend ai`, `--describe`, `--summarize`, images and audio/video send
content to an AI provider. Full reference:
`plugins/ailang-parse/skills/ailang-parse/resources/local-cli.md`.

## Available MCP Tools

- **mcpFormats** — Call first. Returns all 17 input formats, 9 output formats, 26 test samples, pricing tiers, and service capabilities.
- **mcpEstimate** — Predict cost and latency before parsing. Shows if AI is required. No auth needed.
- **mcpParse** — Parse a document into structured blocks, Markdown, HTML, or A2UI. Pass `apiKey` for hosted mode.
- **mcpConvert** — Generate a document: docx, pptx, xlsx, odt, odp, ods, html, md, qmd. `input` is a file path, sample_id, https:// URL, or gs:// ref (Business tier).
- **editDocument** — Parse a document, apply JSON edit deltas, and return the modified blocks. Deterministic Office formats only.
- **getUploadUrl** — Business tier only. Returns a pre-authenticated GCS upload URL to PUT large files, bypassing the 32MB request limit. Then pass the `gcs_ref` to `mcpParse`.
- **mcpAuth** — Start RFC 8628 device authorization. Returns a URL for the user to approve.
- **mcpAuthPoll** — Poll for auth completion. Returns API key on approval.
- **mcpAccount** — `action:"status"` (default, quota/usage), `"keys"` (list keys with per-key usage), `"pricing"` (no auth required), `"usage"` (alias for keys).
- **submit_feedback** — Anonymous bug/feature/docs report (`title`, `body`, `category` = bug|feature|docs|limitation, `ailang_version` required; optional `package="sunholo/ailang_parse"` to route to the AILANG Parse inbox).

## Authentication Flow

1. Try `mcpParse` — if you get `AUTH_REQUIRED`, the error includes `suggested_fix`
2. Call `mcpAuth(label: "your-agent-name")` — returns `verification_url` and `user_code`
3. Tell the user to open the URL and approve
4. Poll with `mcpAuthPoll(deviceCode)` every 5 seconds until approved
5. Use the returned `api_key` in all subsequent calls

## Supported Formats

| Category | Formats | AI Required |
|----------|---------|-------------|
| Office | DOCX, PPTX, XLSX, ODT, ODP, ODS | No (deterministic, 5-50ms) |
| Text | CSV, Markdown, HTML, EPUB, EML, MBOX, TEX, RTF | No |
| PDF/Image | PDF, PNG, JPG | Yes |
| Audio/Video | WAV, MP3, MP4, and other media | Local CLI only — the hosted API rejects these |

## Error Handling

All errors include a `suggested_fix` field with plain-text instructions you can act on directly. Key error codes: `AUTH_REQUIRED`, `INVALID_API_KEY`, `QUOTA_EXCEEDED`, `AI_QUOTA_EXCEEDED`, `FILE_NOT_FOUND`, `FILE_TOO_LARGE`.

## Pricing

Per-document pricing (not per-page). Free: 1,000 requests/month, 50 AI parses. Pro EUR 29/month: 100K requests, 500 AI. Business EUR 99/month: 500K requests, 2,000 AI.

## API

Base URL: `https://docparse.ailang.sunholo.com`
MCP endpoint: `https://docparse.ailang.sunholo.com/mcp/`
Documentation: `https://www.sunholo.com/ailang-parse/`
