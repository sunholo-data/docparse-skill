# AILANG Parse — Claude Code Plugin

Parse any document into structured blocks using the [AILANG Parse API](https://www.sunholo.com/docparse/).

## Install

```bash
claude install github:sunholo-data/docparse-skill
```

## What It Does

This plugin registers an **MCP server** and a **skill** for document parsing. When installed, Claude automatically gets 7 tools:

| Tool | Purpose |
|------|---------|
| `mcpParse` | Parse any document into blocks, Markdown, or HTML |
| `mcpConvert` | Convert between 17 input and 9 output formats |
| `mcpFormats` | Discover formats, samples, pricing, capabilities |
| `mcpEstimate` | Predict cost/latency before parsing |
| `mcpAuth` | Get an API key via device auth (RFC 8628) |
| `mcpAuthPoll` | Poll for auth completion |
| `mcpAccount` | View tier, quota, usage, pricing, history |

Just ask Claude to parse a document — the MCP tools handle everything automatically, including authentication.

## Quick Start

```
# Ask Claude directly:
"Parse this DOCX file and show me the headings"
"Extract tables from report.xlsx"
"Convert this PDF to markdown"
"What formats do you support for document parsing?"
"How much would it cost to parse this file?"
```

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

| Category | Formats | Speed |
|----------|---------|-------|
| Office | DOCX, PPTX, XLSX, ODT, ODP, ODS | 5-50ms deterministic |
| Text | CSV, Markdown, HTML, EPUB, EML, MBOX | 5-15ms deterministic |
| PDF/Image | PDF, PNG, JPG | AI-powered |
| Audio/Video | MP3, MP4 | AI-powered |

## Pricing

Per-document pricing (not per-page). A 1-page or 1,000-page document costs the same.

| Tier | Monthly | Requests | AI Parses |
|------|---------|----------|-----------|
| Free | EUR 0 | 1,000 | 50 |
| Pro | EUR 29 | 100,000 | 500 |
| Business | EUR 99 | 500,000 | 2,000 |

## Links

- [Documentation](https://www.sunholo.com/docparse/)
- [API Reference](https://www.sunholo.com/docparse/api.html)
- [MCP Server Guide](https://www.sunholo.com/docparse/mcp.html)
- [Pricing](https://www.sunholo.com/docparse/pricing.html)
