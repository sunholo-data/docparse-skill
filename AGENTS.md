# AILANG Parse — Agent Guidelines

This repository is a plugin for AI coding assistants that provides universal document parsing via the AILANG Parse API.

## What This Plugin Does

When installed, it registers an MCP server at `https://docparse.ailang.sunholo.com/mcp/` with 7 tools for document parsing, format conversion, cost estimation, authentication, and account management.

## Available MCP Tools

- **mcpFormats** — Call first. Returns all 17 input formats, 9 output formats, 26 test samples, pricing tiers, and service capabilities.
- **mcpEstimate** — Predict cost and latency before parsing. Shows if AI is required.
- **mcpParse** — Parse a document into structured blocks, Markdown, or HTML. Pass `apiKey` for hosted mode.
- **mcpConvert** — Convert between formats (e.g. DOCX to HTML, Markdown to PPTX).
- **mcpAuth** — Start RFC 8628 device authorization. Returns a URL for the user to approve.
- **mcpAuthPoll** — Poll for auth completion. Returns API key on approval.
- **mcpAccount** — View account tier, quota, usage, pricing, or parse history. `action:"pricing"` works without auth.

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
| Text | CSV, Markdown, HTML, EPUB, EML, MBOX | No |
| PDF/Image | PDF, PNG, JPG | Yes |
| Audio/Video | MP3, MP4 | Yes |

## Error Handling

All errors include a `suggested_fix` field with plain-text instructions you can act on directly. Key error codes: `AUTH_REQUIRED`, `INVALID_API_KEY`, `QUOTA_EXCEEDED`, `AI_QUOTA_EXCEEDED`, `FILE_NOT_FOUND`, `FILE_TOO_LARGE`.

## Pricing

Per-document pricing (not per-page). Free: 1,000 requests/month, 50 AI parses. Pro EUR 29/month: 100K requests, 500 AI. Business EUR 99/month: 500K requests, 2,000 AI.

## API

Base URL: `https://docparse.ailang.sunholo.com`
MCP endpoint: `https://docparse.ailang.sunholo.com/mcp/`
Documentation: `https://www.sunholo.com/docparse/`
