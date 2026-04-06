# AILANG Parse — Claude Code Plugin

This is the Claude Code plugin for [AILANG Parse](https://www.sunholo.com/docparse/), a universal document parsing and generation API.

## MCP Server

This plugin registers an MCP server at `https://docparse.ailang.sunholo.com/mcp/` which provides 7 tools:

| Tool | Purpose | Auth Required |
|------|---------|---------------|
| `mcpParse` | Parse any document into blocks, Markdown, or HTML | Hosted: yes |
| `mcpConvert` | Convert between 17 input and 9 output formats | Hosted: yes |
| `mcpFormats` | Discover formats, 26 samples, pricing tiers, capabilities | No |
| `mcpEstimate` | Predict cost/latency before parsing | No |
| `mcpAuth` | Start device auth to get an API key (RFC 8628) | No |
| `mcpAuthPoll` | Poll for auth completion | No |
| `mcpAccount` | View tier, quota, usage, pricing, history | Yes (except `action:"pricing"`) |

## Recommended Workflow

1. Call `mcpFormats` first to discover capabilities, samples, and pricing
2. Call `mcpEstimate` to check if AI is needed and predict cost
3. Call `mcpParse` or `mcpConvert` with the document
4. If you get `AUTH_REQUIRED`, call `mcpAuth` to start device auth, then `mcpAuthPoll`

## Authentication

- **No auth needed** for `mcpFormats`, `mcpEstimate`, and `mcpAccount(action:"pricing")`
- **API key required** for `mcpParse`, `mcpConvert`, and other `mcpAccount` actions
- Keys use `dp_` prefix (e.g. `dp_a1b2c3d4...`)
- Get a key via `mcpAuth` (device flow) or the [dashboard](https://www.sunholo.com/docparse/dashboard.html)
- Pass as `apiKey` parameter in tool calls, or set `DOCPARSE_API_KEY` env var for scripts

## Fallback Scripts

If MCP is unavailable, shell scripts in `skills/ailang-parse/scripts/` provide the same functionality:

```bash
bash skills/ailang-parse/scripts/health.sh        # Check API health
bash skills/ailang-parse/scripts/parse.sh FILE FMT # Parse a document
bash skills/ailang-parse/scripts/estimate.sh FILE  # Estimate cost
bash skills/ailang-parse/scripts/samples.sh        # List test files
bash skills/ailang-parse/scripts/capabilities.sh   # Full service contract
bash skills/ailang-parse/scripts/device-auth.sh    # Get API key
```

## Supported Formats

**Input (17):** DOCX, PPTX, XLSX, ODT, ODP, ODS, HTML, Markdown, CSV, EPUB, EML, MBOX, PDF, PNG, JPG, MP3, MP4

**Output (9):** DOCX, PPTX, XLSX, ODT, ODP, ODS, HTML, Markdown, QMD (Quarto)

Office formats are deterministic (5-50ms). PDF, images, audio, video require AI.

## Pricing

Per-document, not per-page. Free: 1,000/month + 50 AI. Pro EUR 29: 100K + 500 AI. Business EUR 99: 500K + 2,000 AI.

## API Base URL

Production: `https://docparse.ailang.sunholo.com`
