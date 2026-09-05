# Gemini Workspace Guidance — AILANG Parse Plugin

This repository is a plugin for AI coding assistants that provides universal document parsing via the AILANG Parse API.

## Project Structure

- `.claude-plugin/marketplace.json` — Marketplace manifest.
- `plugins/ailang-parse/.claude-plugin/plugin.json` + `.mcp.json` — Plugin manifest; registers the MCP server.
- `plugins/ailang-parse/skills/ailang-parse/SKILL.md` — Skill definition.
- `plugins/ailang-parse/skills/ailang-parse/scripts/` — Shell scripts for parsing, estimation, auth, health checks.
- `plugins/ailang-parse/skills/ailang-parse/resources/` — API reference, integration guide, and local CLI reference.

## Hosted API vs local CLI

The MCP server is the **hosted** service — documents are uploaded to it. The
local `docparse` CLI runs the same parsers on the user's machine and uploads
nothing. Pick one deliberately and state which you are using.

Prefer the local CLI for confidential or restricted material, files over 32MB,
audio/video, PDFs needing the `docling`/`liteparse` backends (hosted is capped
at 30s), and `--generate` (prompt-to-document, not on the hosted API).

```bash
# One command, no clone (ailang_parse 0.40.0+); installs the runtime too.
curl -fsSL https://www.sunholo.com/ailang-parse/install.sh | sh

# PDF only — a scanned PDF needs docling even on the default backend, because
# pdftotext escalates to it automatically when there is no text layer
brew install poppler                                  # apt: poppler-utils
docparse --install-backends
# AI backends: gcloud auth application-default login (ADC, not an API key)

docparse report.docx --output-dir ./parsed
```

Caveat: only deterministic backends are truly offline. `--pdf-backend ai`,
`--describe`, `--summarize`, images and audio/video send content to an AI
provider. Full reference:
`plugins/ailang-parse/skills/ailang-parse/resources/local-cli.md`.

## MCP Server

The plugin registers an MCP server at `https://docparse.ailang.sunholo.com/mcp/` providing 10 tools:

1. **mcpFormats** — Discover formats, samples, pricing. Call this first. No auth needed.
2. **mcpEstimate** — Predict cost/latency before parsing. No auth needed.
3. **mcpParse** — Parse documents into blocks, Markdown, HTML, or A2UI.
4. **mcpConvert** — Generate a document — docx, pptx, xlsx, odt, odp, ods, html, md, qmd.
5. **editDocument** — Parse a document, apply JSON edit deltas, return modified blocks (Office formats only).
6. **getUploadUrl** — Business tier only. Pre-authenticated GCS upload URL for large files.
7. **mcpAuth** — Start RFC 8628 device auth to get an API key.
8. **mcpAuthPoll** — Poll for auth completion.
9. **mcpAccount** — `status` (default), `keys`, `usage`, `pricing` (no auth).
10. **submit_feedback** — Anonymous bug/feature/docs report. Use `package="sunholo/ailang_parse"`.

## Supported Formats

**Input (17):** DOCX, PPTX, XLSX, ODT, ODP, ODS, HTML, Markdown, CSV, EPUB, EML, MBOX, TEX, RTF, PDF, PNG, JPG

**Output (9):** DOCX, PPTX, XLSX, ODT, ODP, ODS, HTML, Markdown, QMD

Office/text formats are deterministic (5-50ms, no AI). On the hosted API, PDF and images require AI; the local CLI parses PDFs deterministically via `pdftotext`. Audio/video are local CLI only — not on the hosted API.

## Authentication

API keys use `dp_` prefix. Get one via the device auth flow (`mcpAuth` tool) or the dashboard at https://www.sunholo.com/docparse/dashboard.html

## Shell Scripts (if MCP unavailable)

```bash
export DOCPARSE_API_KEY="dp_your_key"
bash plugins/ailang-parse/skills/ailang-parse/scripts/health.sh        # Check API
bash plugins/ailang-parse/skills/ailang-parse/scripts/parse.sh FILE FMT # Parse document
bash plugins/ailang-parse/skills/ailang-parse/scripts/estimate.sh FILE  # Estimate cost
bash plugins/ailang-parse/skills/ailang-parse/scripts/samples.sh        # List test files
bash plugins/ailang-parse/skills/ailang-parse/scripts/device-auth.sh    # Get API key
```

## API

- Base URL: `https://docparse.ailang.sunholo.com`
- Docs: `https://www.sunholo.com/ailang-parse/`
- Pricing: Per-document (not per-page). Free tier: 1,000/month.
