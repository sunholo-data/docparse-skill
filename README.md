# AILANG Parse — Claude Code Plugin

Parse any document into structured blocks — and generate documents in 9 formats — using the [AILANG Parse API](https://www.sunholo.com/ailang-parse/).

## Install

Inside Claude Code, add the marketplace and install the plugin:

```
/plugin marketplace add sunholo-data/docparse-skill
/plugin install ailang-parse@ailang-parse-marketplace
```

## Two ways to run it — pick one deliberately

This plugin registers an MCP server against the **hosted** AILANG Parse API, so
documents parsed through it are **uploaded to the cloud service**. That is the
right default for general use and needs no setup.

For material that must not leave the machine — confidential, client-privileged,
under NDA — use the **local `docparse` CLI** instead. It runs the same parsers
and generators from the public
[ailang-parse](https://github.com/sunholo-data/ailang-parse) repo, on your own
hardware:

```bash
curl -fsSL https://ailang.sunholo.com/install.sh | bash        # AILANG runtime
git clone https://github.com/sunholo-data/ailang-parse.git
ln -s "$PWD/ailang-parse/bin/docparse" /usr/local/bin/docparse

docparse report.docx --output-dir ./parsed
```

The two coexist. Once the plugin is installed, the skill carries the decision
rule and tells you which path a given parse is using, so you are never
uploading a document by accident.

The local CLI also does things the hosted API cannot: files over 32MB, audio and
video, the slow local PDF backends (`docling`, `liteparse` — the hosted API is
capped at 30s), and AI generation from a prompt (`--generate`). Full reference:
[`plugins/ailang-parse/skills/ailang-parse/resources/local-cli.md`](plugins/ailang-parse/skills/ailang-parse/resources/local-cli.md).

**Caveat:** "local" is a property of the backend, not the CLI. Office, ODF,
text, HTML, EPUB, email and `pdftotext`/`docling`/`liteparse` PDFs never touch
the network — but `--pdf-backend ai`, `--describe`, `--summarize`, images and
audio/video all send content to an AI provider.

## What It Does

This plugin registers an **MCP server** and a **skill** for document parsing and generation. When installed, Claude automatically gets these tools:

| Tool | Purpose |
|------|---------|
| `mcpParse` | Parse any document into blocks, Markdown, HTML, or A2UI |
| `mcpConvert` | Generate a document — docx, pptx, xlsx, odt, odp, ods, html, md, qmd |
| `editDocument` | Parse a document, apply JSON edit deltas, return modified blocks (Office formats only) |
| `getUploadUrl` | Pre-authenticated GCS upload URL for large files (Business tier) |
| `mcpFormats` | Discover formats, samples, pricing, capabilities |
| `mcpEstimate` | Predict cost/latency before parsing |
| `mcpAuth` | Get an API key via device auth (RFC 8628) |
| `mcpAuthPoll` | Poll for auth completion |
| `mcpAccount` | View status, keys/usage, or pricing (no auth for pricing) |
| `submit_feedback` | Report a bug / feature / docs gap to the maintainers |

Just ask Claude to parse or produce a document — the MCP tools handle everything automatically, including authentication.

## Quick Start

```
# Reading documents:
"Parse this DOCX file and show me the headings"
"Extract tables from report.xlsx"
"Convert this PDF to markdown"

# Producing documents:
"Turn these notes into a PowerPoint"
"Write this up as a Word document"
"Give me that summary as an .xlsx"
"Export this analysis as Quarto"

# About the service:
"What formats do you support?"
"How much would it cost to parse this file?"
```

To generate a document, Claude writes Markdown and converts it — front matter,
tables, inline formatting, links and embedded images all carry through. Headers,
footers, comments and tracked changes have no Markdown syntax, so those survive
only when converting *from* a document that already has them.

No manual API key setup needed. If auth is required, Claude will walk you through the device auth flow.

## Manual API Key (Optional)

```bash
# Set your API key if you already have one
export DOCPARSE_API_KEY="dp_your_key_here"
```

Or get one via:
1. [AILANG Parse Dashboard](https://www.sunholo.com/docparse/dashboard.html) — sign in with Google
2. Device auth flow — Claude handles this automatically via `mcpAuth`

## Supported Formats

**Parsing:**

| Category | Formats | Speed |
|----------|---------|-------|
| Office | DOCX, PPTX, XLSX, ODT, ODP, ODS | 5-50ms deterministic |
| Text | CSV, Markdown, HTML, EPUB, EML, MBOX, TEX, RTF | 5-15ms deterministic |
| PDF/Image | PDF, PNG, JPG | AI-powered |
| Audio/Video | WAV, MP3, MP4, and other media | Local CLI only — the hosted API rejects these |

**Generation (9):** DOCX, PPTX, XLSX, ODT, ODP, ODS, HTML, Markdown, QMD (Quarto)

Ask `mcpFormats` for the live list — it is the service's own answer and never goes stale.

## Pricing

Per-document pricing (not per-page). A 1-page or 1,000-page document costs the same.

| Tier | Monthly | Requests | AI Parses |
|------|---------|----------|-----------|
| Free | EUR 0 | 1,000 | 50 |
| Pro | EUR 29 | 100,000 | 500 |
| Business | EUR 99 | 500,000 | 2,000 |

## Links

- [Documentation](https://www.sunholo.com/ailang-parse/)
- [API Reference](https://www.sunholo.com/ailang-parse/api.html)
- [MCP Server Guide](https://www.sunholo.com/ailang-parse/mcp.html)
- [Pricing](https://www.sunholo.com/ailang-parse/pricing.html)
