# DocParse Skill for Claude Code

Parse any document into structured blocks using the [DocParse API](https://sunholo-data.github.io/docparse/).

## Install

```bash
claude install github:sunholo-data/docparse-skill
```

## What It Does

When you mention document parsing, DocParse, or ask to extract content from files, this skill activates and gives Claude access to:

- **Parse documents** — DOCX, PDF, PPTX, XLSX, CSV, HTML, Markdown, EPUB, ODT, ODP, ODS, images, audio, video
- **Estimate costs** — check credit cost before parsing
- **List samples** — test files for verifying integration
- **Device auth** — get API keys without a browser session

## Quick Start

```bash
# Set your API key
export DOCPARSE_API_KEY="dp_your_key_here"

# Parse a document
bash skills/docparse/scripts/parse.sh document.docx blocks

# Or let Claude do it — just ask:
# "Parse this DOCX file and show me the headings"
# "Extract tables from report.xlsx"
# "Convert this PDF to markdown"
```

## Get an API Key

1. Visit [DocParse Dashboard](https://sunholo-data.github.io/docparse/dashboard.html)
2. Sign in with Google
3. Generate a key
4. Set `DOCPARSE_API_KEY` in your environment

Or use the device flow for headless setup:
```bash
bash skills/docparse/scripts/device-auth.sh
```

## Supported Formats

| Category | Formats | Speed |
|----------|---------|-------|
| Office | DOCX, PPTX, XLSX, ODT, ODP, ODS | 11ms deterministic |
| Text | CSV, Markdown, HTML, EPUB | 5-15ms deterministic |
| PDF/Image | PDF, PNG, JPG, GIF, TIFF, WebP | AI-powered |
| Audio | MP3, WAV | AI-powered |
| Video | MP4 | AI-powered |

## Links

- [API Documentation](https://sunholo-data.github.io/docparse/api.html)
- [Swagger UI](https://ailang-dev-docparse-api-ejjw6zt3bq-ew.a.run.app/api/_meta/docs)
- [Capability Manifest](https://ailang-dev-docparse-api-ejjw6zt3bq-ew.a.run.app/api/v1/capabilities)
