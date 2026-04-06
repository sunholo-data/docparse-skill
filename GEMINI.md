# Gemini Workspace Guidance — AILANG Parse Plugin

This repository is a plugin for AI coding assistants that provides universal document parsing via the AILANG Parse API.

## Project Structure

- `.claude-plugin/` — Plugin manifest (plugin.json, marketplace.json). Registers an MCP server.
- `skills/ailang-parse/` — Skill definition with SKILL.md, scripts, and resources.
- `skills/ailang-parse/scripts/` — Shell scripts for parsing, estimation, auth, health checks.
- `skills/ailang-parse/resources/` — API reference and integration guide.

## MCP Server

The plugin registers an MCP server at `https://docparse.ailang.sunholo.com/mcp/` providing 7 tools:

1. **mcpFormats** — Discover formats, samples, pricing. Call this first.
2. **mcpEstimate** — Predict cost/latency before parsing.
3. **mcpParse** — Parse documents into blocks, Markdown, or HTML.
4. **mcpConvert** — Convert between 17 input and 9 output formats.
5. **mcpAuth** — Start RFC 8628 device auth to get an API key.
6. **mcpAuthPoll** — Poll for auth completion.
7. **mcpAccount** — View tier, quota, usage, pricing, history.

## Supported Formats

**Input (17):** DOCX, PPTX, XLSX, ODT, ODP, ODS, HTML, Markdown, CSV, EPUB, EML, MBOX, PDF, PNG, JPG, MP3, MP4

**Output (9):** DOCX, PPTX, XLSX, ODT, ODP, ODS, HTML, Markdown, QMD

Office/text formats are deterministic (5-50ms, no AI). PDF, images, audio, video require AI.

## Authentication

API keys use `dp_` prefix. Get one via the device auth flow (`mcpAuth` tool) or the dashboard at https://www.sunholo.com/docparse/dashboard.html

## Shell Scripts (if MCP unavailable)

```bash
export DOCPARSE_API_KEY="dp_your_key"
bash skills/ailang-parse/scripts/health.sh          # Check API
bash skills/ailang-parse/scripts/parse.sh FILE FMT   # Parse document
bash skills/ailang-parse/scripts/estimate.sh FILE     # Estimate cost
bash skills/ailang-parse/scripts/samples.sh           # List test files
bash skills/ailang-parse/scripts/device-auth.sh       # Get API key
```

## API

- Base URL: `https://docparse.ailang.sunholo.com`
- Docs: `https://www.sunholo.com/docparse/`
- Pricing: Per-document (not per-page). Free tier: 1,000/month.
