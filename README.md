# AILANG Parse — Plugin and Skill for Claude and Codex

Parse any document into structured blocks, and generate documents in 9 formats,
with [AILANG Parse](https://www.sunholo.com/ailang-parse/) — from Claude Code,
Codex, ChatGPT, or the command line.

## Quick start

**Claude Code** — add the marketplace and install the plugin:

```
/plugin marketplace add sunholo-data/docparse-skill
/plugin install ailang-parse@ailang-parse-marketplace
```

**Codex** (CLI, IDE, app) — the same repo is a plugin marketplace; installing it
adds the skill **and** the hosted MCP server:

```bash
codex plugin marketplace add sunholo-data/docparse-skill
# then inside codex: /plugins → AILANG Parse → Install
```

**First use.** The plugin connects to the hosted MCP server at
`https://docparse.ailang.sunholo.com/mcp/connect/`, which signs in with OAuth.
The first time a tool needs your account, the client opens a sign-in page —
sign in with Google or GitHub and click **Allow**. In Claude Code you can also
start it with `/mcp` → **Authenticate**; in Codex, `codex mcp login ailang-parse`.
The client keeps the token: you never copy or paste an API key. The access key
the app receives is listed on your
[dashboard](https://www.sunholo.com/docparse/dashboard.html) as `oauth: …`, and
you can revoke it there.

Then just ask:

```
"Parse this DOCX file and show me the headings"
"Extract the tables from report.xlsx"
"Turn these notes into a PowerPoint"
"Write this up as a Word document using letterhead.docx"
"How much would it cost to parse this PDF?"
```

To generate a document, the agent writes Markdown and converts it — front
matter, tables, inline formatting, links and embedded images all carry through.
Headers, footers, comments and tracked changes have no Markdown syntax, so they
survive only when converting *from* a document that already has them.

## Hosted or local — pick one deliberately

The MCP tools use the **hosted** service, so documents parsed through them are
**uploaded**. That is the right default for general use and needs no setup.

For material that must not leave the machine — confidential, client-privileged,
under NDA — use the **local `docparse` CLI**. It runs the same parsers and
generators from the public
[ailang-parse](https://github.com/sunholo-data/ailang-parse) repo on your own
hardware:

```bash
curl -fsSL https://www.sunholo.com/ailang-parse/install.sh | sh

docparse report.docx --output-dir ./parsed
docparse notes.md --convert slides.pptx
```

One command, no clone (ailang_parse **0.40.0+**): it installs the AILANG runtime
if needed, fetches the published package (~400 KB), and puts `docparse` on your
`PATH`. `--version`, `--prefix`, `--bindir` and `--uninstall` are supported;
re-running is a no-op. PDFs need two more steps that are easy to miss:

```bash
brew install poppler          # pdftotext, the default backend
                              # (apt install poppler-utils on Debian/Ubuntu)
docparse --install-backends   # docling + liteparse, for scans and layout
```

Without `docling`, a **scanned** PDF fails even on the default backend —
`pdftotext` escalates to it automatically when it finds no text layer.

If `ailang` is already installed, `ailang install sunholo/ailang_parse`
(0.42.0+) is a shorter route to a *thin* `docparse`: one file in, output beside
it — no `--output-dir`, batch, `--describe` or PDF backends.

The local CLI also does what the hosted API cannot: files over the hosted size
limit, audio and video, the slow local PDF backends (`docling`, `liteparse` —
hosted requests are capped at 30s), and AI generation from a prompt
(`--generate`). Full reference:
[`resources/local-cli.md`](plugins/ailang-parse/skills/ailang-parse/resources/local-cli.md).

**Caveat:** "local" is a property of the backend, not the CLI. Office, ODF,
text, HTML, EPUB, email and `pdftotext`/`docling`/`liteparse` PDFs never touch
the network — but `--pdf-backend ai`, `--describe`, `--summarize`, images and
audio/video send content to an AI provider.

The skill carries this decision rule, so the agent says which path a given parse
uses and does not upload a document by accident.

## What you get

| Tool | Purpose |
|------|---------|
| `mcpParse` | Parse any document into blocks, Markdown, HTML, or A2UI |
| `mcpConvert` | Generate a document — docx, pptx, xlsx, odt, odp, ods, html, md, qmd |
| `editDocument` | Parse a document, apply JSON edit deltas, return modified blocks (Office formats only) |
| `getUploadUrl` | Pre-authenticated GCS upload URL for large files (Business tier) |
| `mcpFormats` | Discover formats, samples, pricing, capabilities (no sign-in) |
| `mcpEstimate` | Predict cost/latency before parsing (no sign-in) |
| `mcpAccount` | Status, keys and usage, request-history setting, or pricing |
| `submit_feedback` | Report a bug / feature / docs gap to the maintainers |

Plus the **skill**: when to use the local CLI vs the hosted API, how to author
documents (writing quality, templates, verification), and wrapper scripts.

## Formats

**Parsing (17):**

| Category | Formats | Speed |
|----------|---------|-------|
| Office | DOCX, PPTX, XLSX, ODT, ODP, ODS | 5-50ms deterministic |
| Text | CSV, Markdown, HTML, EPUB, EML, MBOX, TEX, RTF | 5-15ms deterministic |
| PDF / image | PDF, PNG, JPG | hosted: counts as an AI request; local CLI: `pdftotext` first |
| Audio / video | WAV, MP3, MP4, and other media | local CLI only — the hosted API rejects these |

**Generation (9):** DOCX, PPTX, XLSX, ODT, ODP, ODS, HTML, Markdown, QMD (Quarto)

Ask `mcpFormats` for the live list — it is the service's own answer and never
goes stale.

## Pricing (hosted)

Per document, not per page: each parse or conversion is one request, whatever
its length.

| Tier | Monthly | Requests | AI requests (PDF, images) | Max file |
|------|---------|----------|---------------------------|----------|
| Free | EUR 0 | 1,000 | 50 | 10 MB |
| Pro | EUR 29 | 100,000 | 500 | 25 MB |
| Business | EUR 99 | 500,000 | 2,000 | 50 MB |

## Scripts and the REST API

The skill's shell scripts and the REST API take a `dp_` API key instead of
OAuth:

```bash
export DOCPARSE_API_KEY="dp_your_key_here"   # from the dashboard, or:
bash plugins/ailang-parse/skills/ailang-parse/scripts/device-auth.sh
```

Local files are uploaded (the API never reads a path on your disk), and the
scripts send the key as a header. Headless MCP clients without a browser can
use the agent surface `https://docparse.ailang.sunholo.com/mcp/`, which adds the
device-auth tools (`mcpAuth`, `mcpAuthPoll`) and takes the key as an
`Authorization: Bearer` or `X-API-Key` header. Endpoint reference:
[`resources/api-reference.md`](plugins/ailang-parse/skills/ailang-parse/resources/api-reference.md).

## Other setups

### Skill only, shared across Claude and Codex

Codex discovers user-wide skills in `~/.agents/skills` and follows symlinked
skill folders, so a clone of this repo can be the single source of truth:

```bash
git clone https://github.com/sunholo-data/docparse-skill && cd docparse-skill
DOCPARSE_SKILL_REPO="$(pwd -P)"
mkdir -p ~/.agents/skills
ln -s "$DOCPARSE_SKILL_REPO/plugins/ailang-parse/skills/ailang-parse" ~/.agents/skills/ailang-parse
# Claude, instead of (not as well as) the marketplace plugin:
mkdir -p ~/.claude/skills
ln -s "$DOCPARSE_SKILL_REPO/plugins/ailang-parse/skills/ailang-parse" ~/.claude/skills/ailang-parse
```

Inspect any existing skill directory or symlink before replacing it, and avoid
installing both the standalone skill and the plugin in Claude (duplicate skill
entries). `git pull --ff-only` updates linked installs; a cached marketplace
plugin needs its own update. In Codex, invoke `$ailang-parse` or just ask; if
the skill is missing from the selector, restart Codex.

A skill symlink does **not** register the MCP server. The local CLI works
without it; for hosted access add it separately:

```bash
codex mcp add ailang-parse --url https://docparse.ailang.sunholo.com/mcp/connect/
```

Codex starts the OAuth sign-in when it adds the server (or later with
`codex mcp login ailang-parse`). See
[Codex skills](https://learn.chatgpt.com/docs/build-skills) and
[MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).

### pi (pi-coding-agent)

pi does not load MCP servers, so pi users install the sibling extension:
[`pi-extension/`](pi-extension/) registers native pi tools (`docparse_parse`,
`docparse_convert`, `docparse_generate`, `docparse_status`) plus a
`/docparse-login` device-flow command, calling the local CLI and the hosted
REST API:

```bash
ln -s "$DOCPARSE_SKILL_REPO/pi-extension" ~/.pi/agent/extensions/docparse
```

### Authoring and verification tools

The skill's `scripts/audit.sh` and `scripts/render.sh` wrap the AILANG Parse
companions `docparse-audit` and `docparse-render`, which the `curl | sh`
installer puts on `PATH` (ailang_parse 0.41.0+; the thin `ailang install` shim
does not include them). Set `DOCPARSE_AUDIT_BIN` / `DOCPARSE_RENDER_BIN` to
override. Office rendering additionally needs LibreOffice and Poppler.

## For maintainers

One plugin directory serves both ecosystems; the skill and the MCP URL exist once.

| File | Read by |
|---|---|
| `.claude-plugin/marketplace.json` | Claude Code |
| `.agents/plugins/marketplace.json` | Codex / ChatGPT |
| `plugins/ailang-parse/.claude-plugin/plugin.json` + `.mcp.json` | Claude Code |
| `plugins/ailang-parse/plugin.json` + `mcp.json` | [Agent Plugins](https://agent-plugins.org) — Codex, ChatGPT, OpenAI Plugin Directory |
| `plugins/ailang-parse/skills/ailang-parse/` | both (Agent Skills standard; `agents/openai.yaml` is Codex UI metadata) |

CI (`validate.yml`) runs `claude plugin validate --strict`, an install smoke
test in Codex, and `scripts/validate-agent-plugins.mjs` (Agent Plugins JSON
Schemas + same-version / same-MCP-URL / OpenAI listing-limit checks). Keep the
two `plugin.json` versions and the two MCP URLs in step.

## Links

- [Documentation](https://www.sunholo.com/ailang-parse/)
- [API Reference](https://www.sunholo.com/ailang-parse/api.html)
- [MCP Server Guide](https://www.sunholo.com/ailang-parse/mcp.html)
- [Pricing](https://www.sunholo.com/ailang-parse/pricing.html)
