# AILANG Parse — Shared Skill and Claude Code Plugin

Parse any document into structured blocks — and generate documents in 9 formats — using the [AILANG Parse API](https://www.sunholo.com/ailang-parse/).

## Install

Inside Claude Code, add the marketplace and install the plugin:

```
/plugin marketplace add sunholo-data/docparse-skill
/plugin install ailang-parse@ailang-parse-marketplace
```

In Codex (CLI, IDE, app), add the same repo as a plugin marketplace — this
installs the skill **and** the hosted MCP server in one step:

```bash
codex plugin marketplace add sunholo-data/docparse-skill
# then inside codex: /plugins → AILANG Parse → Install
```

### Package layout

One plugin directory serves both ecosystems; the skill and the MCP URL exist once.

| File | Read by |
|---|---|
| `.claude-plugin/marketplace.json` | Claude Code |
| `.agents/plugins/marketplace.json` | Codex / ChatGPT |
| `plugins/ailang-parse/.claude-plugin/plugin.json` + `.mcp.json` | Claude Code |
| `plugins/ailang-parse/plugin.json` + `mcp.json` | [Agent Plugins](https://agent-plugins.org) — Codex, ChatGPT, OpenAI Plugin Directory |
| `plugins/ailang-parse/skills/ailang-parse/` | both (Agent Skills standard; `agents/openai.yaml` is Codex UI metadata) |

CI (`validate.yml`) runs `claude plugin validate --strict`, an install smoke
test, and `scripts/validate-agent-plugins.mjs` (Agent Plugins JSON Schemas +
same-version / same-MCP-URL / OpenAI listing-limit checks).

## Global Codex skill and shared Claude installation

Codex discovers user-wide skills in `~/.agents/skills` and follows symlinked
skill folders. Keep this repo as the single source of truth instead of copying
SKILL.md into each agent's configuration. From a clone of this repo:

```bash
git pull --ff-only
DOCPARSE_SKILL_REPO="$(pwd -P)"
mkdir -p ~/.agents/skills
ln -s "$DOCPARSE_SKILL_REPO/plugins/ailang-parse/skills/ailang-parse" \
  ~/.agents/skills/ailang-parse
```

Do not overwrite an existing skill directory or symlink: inspect its target
first. For Claude, either keep the marketplace plugin installation above or
link this same folder into `~/.claude/skills/ailang-parse`:

```bash
mkdir -p ~/.claude/skills
ln -s "$DOCPARSE_SKILL_REPO/plugins/ailang-parse/skills/ailang-parse" \
  ~/.claude/skills/ailang-parse
```

Avoid installing both the standalone Claude skill and the plugin's copy if that
would create duplicate skill entries. Linked installations share edits
immediately; a cached Claude marketplace plugin needs its own update. Subsequent
`git pull --ff-only` updates the linked skill; commit or otherwise preserve local
edits before syncing if they overlap upstream changes.

In Codex, invoke `$ailang-parse` or ask naturally about docparse, Word document
creation, or conversion. Automatic invocation remains enabled. Codex detects
skill updates; if the skill is absent from the selector, restart Codex. This is
a laptop-wide installation for local sessions using this home directory, not
an installation on remote hosts or cloud environments.

A skill symlink does **not** install an MCP server. The local CLI works without
one. For optional hosted access, register the connection separately:

```bash
codex mcp add ailang-parse --url https://docparse.ailang.sunholo.com/mcp/
```

Use the service's device-auth tools if its API requests a key. Installing a
skill does not copy Claude credentials or hooks into Codex. See
[Codex skills](https://learn.chatgpt.com/docs/build-skills) and
[MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).

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
curl -fsSL https://www.sunholo.com/ailang-parse/install.sh | sh

docparse report.docx --output-dir ./parsed
```

One command, no clone (ailang_parse **0.40.0+**). It installs the AILANG runtime
if you do not have it, fetches the published package (~400 KB, not the 24 MB
repo archive), and puts `docparse` on your `PATH`. `--version`, `--prefix` and
`--uninstall` are supported; re-running is a no-op.

That is everything for Office, ODF, HTML, Markdown, CSV, TeX, EPUB and email.
PDF needs two more steps that are easy to miss:

```bash
brew install poppler          # pdftotext, the default backend
                              # (apt install poppler-utils on Debian/Ubuntu)
docparse --install-backends   # docling + liteparse, for scans and layout
```

Without `docling`, a **scanned** PDF fails even on the default backend —
`pdftotext` escalates to it automatically when it finds no text layer.

If `ailang` is already installed, `ailang install sunholo/ailang_parse`
(0.42.0+) is the shorter route: it puts a thin `docparse` shim on `PATH` that
parses or `--convert`s one file, output beside the input — without the
wrapper's `--output-dir`, batch, `--describe` or PDF backends. Contributors can
still `git clone` the repo and symlink `bin/docparse`; that remains the
development workflow.

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

## pi (pi-coding-agent)

pi does not load MCP servers, so pi users install the sibling extension
instead: [`pi-extension/`](pi-extension/) registers native pi tools
(`docparse_parse`, `docparse_convert`, `docparse_generate`, `docparse_status`)
plus a `/docparse-login` device-flow command, calling the local CLI and the
same hosted API (parse, convert and the local-only prompt generation). Install:

```bash
ln -s ~/dev/sunholo/docparse-skill/pi-extension ~/.pi/agent/extensions/docparse
```

## Links

- [Documentation](https://www.sunholo.com/ailang-parse/)
- [API Reference](https://www.sunholo.com/ailang-parse/api.html)
- [MCP Server Guide](https://www.sunholo.com/ailang-parse/mcp.html)
- [Pricing](https://www.sunholo.com/ailang-parse/pricing.html)

### Authoring and verification

The skill includes on-demand writing-quality and template-inspection guidance.
Its local `scripts/audit.sh` and `scripts/render.sh` wrappers call the AILANG Parse
companions `docparse-audit` and `docparse-render`. These companions are currently
in the Parse checkout's unreleased changes; older published installs may not
include them. Update the engine when released, or set `DOCPARSE_AUDIT_BIN` and
`DOCPARSE_RENDER_BIN` to the checkout executables. Rendering/comparison and audits
are implemented in AILANG; Office rendering additionally uses LibreOffice and
Poppler. No new Python dependency is required.
