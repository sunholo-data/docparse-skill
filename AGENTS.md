# AILANG Parse — Agent Guidelines

This repository is a plugin for AI coding assistants that provides universal document parsing via the AILANG Parse API.

> **pi users:** pi does not load MCP servers. The `pi-extension/` directory in
> this repo is the pi-native equivalent — native tools wrapping the local CLI
> and the hosted REST API, with shared device-flow auth. See
> `pi-extension/README.md`.

## What This Plugin Does

When installed as a plugin (Claude, Codex, ChatGPT), it registers an MCP server at `https://docparse.ailang.sunholo.com/mcp/connect/` with 8 tools for document parsing, editing, generation, format conversion, cost estimation, file upload, and account management. It signs in with OAuth.

A standalone Codex or Claude skill symlink does not register MCP. Use the
available local CLI or an explicitly configured hosted connection. The shared
entrypoint is `plugins/ailang-parse/skills/ailang-parse/SKILL.md`; keep agent
instructions there and optional Codex UI metadata in its `agents/openai.yaml`.
See README.md for the global symlink installation.

## Choose the path before the first call

The MCP tools are the **hosted** service: the document is uploaded. The local
`docparse` CLI runs the same parsers on the machine, uploading nothing. Tell the
user which one you are about to use.

Use the local CLI when the material is confidential, restricted, or the user
asked to keep it offline; for files over the hosted limit (10 MB Free, 25 MB Pro,
50 MB Business); for audio/video; when a PDF needs
the `docling`/`liteparse` backends (the hosted API's 30s cap kills them); or for
`--generate` (prompt-to-document, hosted has no equivalent). When in doubt about
sensitivity, ask — do not upload by default.

```bash
# Install: one command, no clone (ailang_parse 0.40.0+). Installs the AILANG
# runtime too, and puts docparse on PATH.
curl -fsSL https://www.sunholo.com/ailang-parse/install.sh | sh

# PDF only: pdftotext is the default backend; docling/liteparse are Python
# packages in the install's uv env. Without docling, a SCANNED PDF fails even
# on the default backend, because pdftotext escalates to it automatically.
brew install poppler                                  # apt: poppler-utils
docparse --install-backends
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
- **mcpParse** — Parse a document into structured blocks, Markdown, HTML, or A2UI.
- **mcpConvert** — Generate a document: docx, pptx, xlsx, odt, odp, ods, html, md, qmd. `input` is a file path, sample_id, https:// URL, or gs:// ref (Business tier).
- **editDocument** — Parse a document, apply JSON edit deltas, and return the modified blocks. Deterministic Office formats only.
- **getUploadUrl** — Business tier only. Returns a pre-authenticated GCS upload URL to PUT large files, bypassing the 32MB request limit. Then pass the `gcs_ref` to `mcpParse`.
- **mcpAccount** — `action:"status"` (default, quota/usage), `"keys"` (list keys with per-key usage), `"pricing"` (no auth required), `"usage"` (alias for keys), `"history"` / `"history_on"` / `"history_off"`.
- **submit_feedback** — Anonymous bug/feature/docs report (`title`, `body`, `category` = bug|feature|docs|limitation, `ailang_version` required; optional `package="sunholo/ailang_parse"` to route to the AILANG Parse inbox).

## Authentication Flow

On `/mcp/connect/` (the plugin) sign-in is OAuth 2.1 and the **client** runs it: the first call
to a tool that needs an account answers 401, the client opens a sign-in page, the user signs in
with Google or GitHub and approves, and the client retries with its token. Tools take no
`apiKey` argument. Never ask the user to paste a key into the chat.

Headless agents with no browser can use the agent surface `/mcp/` instead:

1. Call `mcpAuth(label: "your-agent-name")` — returns `verification_url` and `user_code`
2. Tell the user to open the URL and approve
3. Poll with `mcpAuthPoll(deviceCode)` every 5 seconds until approved
4. Send the returned `api_key` as an `Authorization: Bearer` or `X-API-Key` header (or as the
   `apiKey` argument if the client cannot set headers)

## Supported Formats

| Category | Formats | AI Required |
|----------|---------|-------------|
| Office | DOCX, PPTX, XLSX, ODT, ODP, ODS | No (deterministic, 5-50ms) |
| Text | CSV, Markdown, HTML, EPUB, EML, MBOX, TEX, RTF | No |
| PDF/Image | PDF, PNG, JPG | Yes |
| Audio/Video | WAV, MP3, MP4, and other media | Local CLI only — the hosted API rejects these |

## Error Handling

All errors include a `suggested_fix` field with plain-text instructions you can act on directly. Key error codes: `INVALID_API_KEY`, `QUOTA_EXCEEDED`, `INPUT_NOT_FOUND` (a local path sent instead of an upload), `FILE_TOO_LARGE`, `WORKBOOK_TOO_COMPLEX`, `UNSUPPORTED_FORMAT`, `PARSE_FAILED`. On the agent surface `/mcp/` a missing key is `AUTH_REQUIRED`; on `/mcp/connect/` it is an HTTP 401 that the client answers with OAuth.

## Pricing

Per-document pricing (not per-page): each parse or conversion is one request; PDFs and images also count as one AI request. Free: 1,000 requests/month, 50 AI, 10 MB files. Pro EUR 29/month: 100K requests, 500 AI, 25 MB. Business EUR 99/month: 500K requests, 2,000 AI, 50 MB. Live limits: `mcpFormats` or `GET /api/v1/pricing`.

## API

Base URL: `https://docparse.ailang.sunholo.com`
MCP endpoint: `https://docparse.ailang.sunholo.com/mcp/connect/` (OAuth; agent surface with device auth: `/mcp/`)
Documentation: `https://www.sunholo.com/ailang-parse/`
