# docparse pi extension

A [pi](https://github.com/badlogic/pi-mono) extension — the pi-native
equivalent of the `ailang-parse` Claude plugin in this repo. pi does not load
MCP servers, so instead of pointing at the hosted MCP endpoint
(`https://docparse.ailang.sunholo.com/mcp/`) it registers **native pi tools**
that call the same backend:

| Transport | What | Auth | Best for |
|---|---|---|---|
| **CLI** | local `docparse` binary (AILANG Parse CLI) | local AI keys (env) | Local files, all formats (Office/ODF/EPUB/EML/TeX/images/**audio/video** — self-host-only on the hosted API), deterministic PDFs, scanned PDFs via `pdf_backend: "ai"`, convert/generate |
| **Hosted API** | `https://docparse.ailang.sunholo.com` REST `/api/v1/*` | `dp_…` API key (device flow) | URL parsing (`url` param), no local install at all, tier-metered quota |

Claude Code users get the full 10-tool MCP surface (`mcpParse`, `mcpConvert`,
`editDocument`, `getUploadUrl`, `mcpFormats`, `mcpEstimate`, `mcpAuth`,
`mcpAuthPoll`, `mcpAccount`, `submit_feedback`) via the plugin in
`plugins/ailang-parse/`. pi users get the parse/convert/status subset via
this extension; the device-flow auth is shared (same
`~/.config/ailang-parse/credentials.json`).

## Install (global)

The extension shells out to the local `docparse` binary, so install that first
(ailang_parse **0.40.0+**; no clone needed):

```bash
curl -fsSL https://www.sunholo.com/ailang-parse/install.sh | sh
docparse --install-backends   # optional: local OCR/layout PDF backends
```

Then link the extension:

```bash
ln -s ~/dev/sunholo/docparse-skill/pi-extension ~/.pi/agent/extensions/docparse
```

Verify from any directory:

```bash
pi -p "/docparse-status"
```

This repo directory is the single source of truth; the symlink picks up
every change (restart pi or `/reload` after edits).

## Auth for the hosted API

```bash
# inside pi:
/docparse-login
```

RFC 8628-style device flow: opens the sunholo approve page, polls every 5 s,
saves the `dp_` key to `~/.config/ailang-parse/credentials.json` (`chmod 600`,
same file the SDKs and the skill scripts use).

Resolution order: `$DOCPARSE_API_KEY` →
`~/.config/ailang-parse/credentials.json` → `~/.pi/agent/docparse-auth.json`.
Overrides: `DOCPARSE_API_KEY`, `DOCPARSE_API_BASE`, `DOCPARSE_BIN`.

## PDF backends (local, all installed)

The CLI resolves backends through the **uv-managed env** of the docparse
install root (the CLI wrapper exports `DOCPARSE_PROJECT_ROOT`, and the adapter
runs `uv run --project <root> python …/pdf_backends/adapter.py` — never the
system python3). `docparse --install-backends` populates it:

| `pdf_backend` | Engine | Notes |
|---|---|---|
| `pdftotext` (default) | poppler text-layer extraction | deterministic, no AI; errors on failure (no fallback) |
| `docling` | IBM Docling (layout-aware; local OCR path when a PDF has no text layer) | in the uv env |
| `liteparse` | run-llama LiteParse — font-size heading inference (**not** OCR) | in the uv env |
| `ai` | multimodal (default `gemini-2.5-flash`, `--ai MODEL` override) | uses local AI keys; the only route for image-only scans |

Hosted API equivalent: `pdf_backend` maps to the `pdfBackend` multipart field
(`pdftotext`/`docling`/`liteparse` error on failure — no AI fallback; omitting
it uses the server default **with** AI fallback). Audio/video parse locally
only.

## Tools

| Tool | Description |
|---|---|
| `docparse_parse` | Parse local paths (CLI) or an https URL (hosted API) → markdown/JSON. Options: `pdf_backend` (`pdftotext`/`docling`/`liteparse`/`ai`), `summarize`, `describe`, `output_dir`, `mode` (`auto`/`cli`/`api`), `output` (`markdown`/`json`/`both`). |
| `docparse_convert` | Create a document in another format (`html docx pptx xlsx odt odp ods md qmd`). Local input → CLI (offline, `--reference-doc` styling); https URL or `mode: "api"` → hosted `/api/v1/convert` (the `mcpConvert` surface; the extension writes the decoded file — base64 for ZIP formats). |
| `docparse_generate` | **CLI-only** — AI-generate a document from a prompt into `docx/pptx/xlsx/odt/odp/ods/html/md/qmd`, optional `--reference-doc` styling. The hosted API deliberately has no prompt-generation endpoint (`/api/v1/convert` transforms existing docs only), so creation-from-prompt needs local AI keys. |
| `docparse_status` | CLI presence + hosted API health + auth state. |

## Commands

- `/docparse-login` — device flow → `dp_` key saved automatically.
- `/docparse-status` — quick status notify.

## Example asks

- "Parse `docs/literature/**` with docparse" → batch CLI parse, markdown back in context.
- "Parse https://example.com/report.pdf" → hosted API `sourceUrl` parse.
- "This PDF is a scan" → `docparse_parse` with `pdf_backend: "ai"`.
- "Convert notes.md to slides" → `docparse_convert` → `notes.pptx`.
- "Convert https://…/report.md to Word via the API" → `docparse_convert` with `url` → hosted `/api/v1/convert`.
- "Turn these notes into a PowerPoint" (no source doc) → `docparse_generate` with a prompt → `slides.pptx`.
- "Make a Word version styled like our letterhead" → `docparse_generate`/`docparse_convert` with `reference_doc`.
- "Transcribe this lecture recording" → CLI parse of WAV/MP4 (hosted API doesn't do audio/video).