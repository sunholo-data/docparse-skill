# Local CLI reference (`docparse`)

The `docparse` CLI runs the **same parsers and generators** as the hosted API,
on the user's own machine. Nothing is uploaded unless an AI backend is
explicitly requested. Use this page when the hosted MCP path is not appropriate
— see "Choose the path first" in `SKILL.md` for the decision rule.

---

## 1. Is it already installed?

```bash
command -v docparse && docparse --help | head -5
command -v ailang   && ailang --version
```

`docparse` is a Bash wrapper around `ailang run`, so **both** must be on `PATH`.
If `docparse` resolves but `ailang` does not, every invocation fails — re-run
the installer in §2, which installs the runtime as well.

## 2. Install

One command, no clone (ailang_parse **0.40.0+**):

```bash
curl -fsSL https://www.sunholo.com/ailang-parse/install.sh | sh
docparse --help
```

It installs the AILANG runtime if you do not have it, fetches the published
package (~400 KB, not the 24 MB repo archive), verifies its sha256, unpacks to
`~/.local/share/ailang-parse/<version>/`, resolves dependencies once, and links
`~/.local/bin/docparse`. Then it reports which optional dependencies are missing
(see §2b) without installing anything for you.

| Flag | Effect |
|---|---|
| `--version X.Y.Z` | pin a version instead of latest |
| `--prefix DIR` | install root (default `~/.local/share/ailang-parse`) |
| `--bindir DIR` | where to link (default `~/.local/bin`) |
| `--uninstall` | remove the prefix and the symlink |

Versions install side by side, so upgrading is a new directory and a moved
symlink. Re-running is a no-op. If `~/.local/bin` is not on `PATH` the installer
says so and prints the line to add.

**Before 0.40.0 there was no such route** — the published package shipped the
`.ail` sources but not the wrapper or the PDF adapter, so a clone was the only
option. If you are on an older version, upgrade rather than working around it.

### Contributors: clone instead

```bash
git clone https://github.com/sunholo-data/ailang-parse.git
ln -s "$PWD/ailang-parse/bin/docparse" /usr/local/bin/docparse
```

The wrapper finds its project root by walking up for `docparse/main.ail`, so it
works from a clone, an installed prefix, or a symlink chain. Note that the
wrapper and the PDF adapter live under `assets/` — the only path the AILANG
publisher bundles verbatim — with symlinks at their historical locations.

## 2b. PDF backends — the part that is easy to miss

PDF is the one format with dependencies outside the clone, and a fresh install
will fail on it in two different ways if you skip this.

### `pdftotext` (default backend)

```bash
brew install poppler          # macOS
sudo apt install poppler-utils  # Debian/Ubuntu
command -v pdftotext          # verify
```

### `docling` and `liteparse` (local OCR / layout)

These are **Python packages inside the docparse installation's own uv
environment**, not system tools. `docparse` shells out to
`uv run --project <install root> python .../pdf_backends/adapter.py`, so `uv`
alone is not enough — the packages have to be synced into that project first,
and in a clone they are **not** in the default dependency group:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh    # uv itself
docparse --install-backends                        # then this
```

`--install-backends` syncs them into whichever uv project the parser resolves at
runtime. On an installed prefix that is a minimal project carrying docling and
liteparse and nothing else; in a clone it is the repo's `pyproject.toml`, whose
`competitors` extra also pulls `unstructured`, `llama-parse`, `markitdown` and
`kreuzberg`. Either way the backends end up where the adapter looks for them.

**This also affects the default path.** When `pdftotext` finds no text layer,
`docparse` automatically escalates to `docling` — both are free, so it does not
ask. If `docling` was never installed, a scanned PDF fails with
`no text layer (pdftotext: …) and OCR found nothing (docling: …)`. Since
0.40.0 that message names `docparse --install-backends`; on older versions it
reads like a bad PDF rather than a missing dependency. `--pdf-backend ai` costs money
and is therefore **never** automatic; the caller must ask for it.

### AI backends

```bash
gcloud auth application-default login
```

AI parsing runs through Google ADC (Vertex AI) — the wrapper deliberately
blanks `GOOGLE_API_KEY` on that path, so exporting an API key does nothing.

### Summary

| Input | Extra needed |
|---|---|
| Office, ODF, HTML, Markdown, CSV, TeX, EPUB, EML, MBOX | none |
| PDF with a text layer | `pdftotext` (poppler) |
| Scanned PDF, or `--pdf-backend docling` / `liteparse` | poppler + `uv`, then `docparse --install-backends` |
| `--pdf-backend ai`, images, audio, video, `--describe`, `--summarize`, `--generate` | Google ADC |

## 3. What actually leaves the machine

This is the whole reason to prefer the CLI, so be precise about it. **"Local"
is a property of the backend you pick, not of the CLI.**

| Invocation | Network |
|---|---|
| `docparse report.docx` (and pptx, xlsx, odt, odp, ods) | none — deterministic XML |
| `docparse notes.md`, `.csv`, `.txt`, `.tex`, `.html`, `.epub`, `.eml`, `.mbox` | none |
| `docparse contract.pdf` (default `pdftotext`) | none — local poppler subprocess |
| `docparse contract.pdf --pdf-backend docling` / `liteparse` | none — local Python ML, via `uv` |
| `docparse x.docx --convert out.pptx` (any `--convert`) | none — deterministic generation |
| `docparse scan.pdf --pdf-backend ai` | **document content sent to the AI provider** |
| `docparse photo.png` (images auto-enable AI) | **content sent** |
| `docparse a.mp3` / `.mp4` (audio & video are AI-only) | **content sent** |
| `--describe` / `--summarize` on any input | **content sent** |
| `--generate out.docx --prompt "..."` | prompt sent; no source document involved |

So for restricted material: stay on the deterministic rows. If a PDF turns out
to be a scan and only `--pdf-backend ai` can read it, that is a decision to put
to the user, not one to make silently.

## 4. Parsing

```bash
docparse report.docx                 # -> <out>/report.json + <out>/report.md
docparse ~/inbox/                    # whole folder
docparse *.eml                       # batch — compiles ONCE
docparse a.docx b.pptx c.xlsx        # batch, mixed formats
```

**Always batch.** The wrapper compiles the AILANG modules on every invocation,
so a shell loop pays that cost per file and runs up to 10x slower:

```bash
docparse ~/Documents/                            # FAST
for f in *.docx; do docparse "$f"; done          # SLOW — do not do this
```

In batch mode each file's output is written as it finishes, so partial results
survive a `Ctrl+C` and can be inspected mid-run.

### Output

| File | Content |
|---|---|
| `<out>/<name>.json` | typed blocks — the structured, authoritative form |
| `<out>/<name>.md` | flattened Markdown, for feeding to an LLM |

`<out>` defaults to `docparse/data` inside the clone. **Set `--output-dir`** to
keep results next to the user's work rather than buried in the repo:

```bash
docparse ~/case-files/ --output-dir /tmp/parsed
```

Read the `.json` when structure matters (tables, merged cells, comments,
tracked changes, headings). Read the `.md` when you just need the prose.

### Block types in the JSON

`TextBlock`, `HeadingBlock`, `TableBlock`, `ListBlock`, `ImageBlock`,
`AudioBlock`, `VideoBlock`, `SectionBlock`, `ChangeBlock` (tracked changes),
`LinkBlock`, `CommentBlock` — the same schema the hosted API returns, so
anything written against `mcpParse` output works unchanged.

## 5. PDF backends

```bash
docparse contract.pdf                              # pdftotext (default)
docparse contract.pdf --pdf-backend docling        # local ML layout
docparse contract.pdf --pdf-backend liteparse      # font-size heading inference
docparse scan.pdf     --pdf-backend ai             # multimodal AI
```

| Backend | Local | Good at | Cost |
|---|---|---|---|
| `pdftotext` | yes | born-digital text, instant | free |
| `docling` | yes | layout/tables; slow (185s on 9 pages is normal) | free |
| `liteparse` | yes | heading structure from font sizes | free |
| `ai` | **no** | scanned / image-only pages | AI tokens |

Escalation is partly automatic: on the default backend, if `pdftotext` finds no
text layer, `docparse` falls back to `docling` on its own — both are free, so no
permission is needed. `ai` costs money and is never automatic. An explicit
`--pdf-backend` is treated as a decision and disables the fallback.

`liteparse` is **not** an OCR fallback: it infers headings from font sizes in an
existing text layer, so it fails on a scan exactly as `pdftotext` does. A
genuinely scanned page needs `docling` (local) or `ai` (not local).

The local backends are slow by design and the wrapper allows **20 minutes**
(`DOCPARSE_PROCESS_TIMEOUT`, any Go duration: `90s`, `5m`, `1h`). This is the
CLI's decisive advantage over the hosted API, which is hard-capped at 30s and
therefore cannot run `docling` or `liteparse` on anything non-trivial at all.

## 6. Converting and generating

```bash
docparse in.docx  --convert out.html
docparse notes.md --convert slides.pptx      # each H1/H2 becomes a slide
docparse in.docx  --convert out.qmd && quarto render out.qmd --to pdf
docparse data.csv --convert report.docx
```

Targets: `html docx pptx xlsx odt odp ods md qmd`. Format comes from the output
extension. Unlike the hosted API, the CLI writes a **real file**, not a
base64 JSON payload — no decoding step, no `encoding` field to branch on.

### Styling from a template

```bash
docparse notes.md --convert offer.docx \
  --reference-doc letterhead.docx \
  --reference-section 1 \
  --table-style "Grid Table 4"
```

`--reference-doc` carries the template's styles, theme, embedded fonts,
headers, footers and page setup onto the new content (DOCX output only) — this
is how you get a running header, which plain Markdown cannot express.

### AI generation from a prompt

```bash
docparse --generate report.docx --prompt "Q1 sales report with a revenue table"
```

**CLI-only.** The hosted `/api/v1/convert` is deterministic conversion and has
no equivalent. Requires an AI backend, so the prompt goes to the provider.

## 7. Useful flags

| Flag | Effect |
|---|---|
| `--output-dir DIR` | write outputs to `DIR` instead of `docparse/data` |
| `--describe` | AI descriptions for images (**sends content**) |
| `--summarize` | AI document summary (**sends content**) |
| `--ai MODEL` | default `gemini-2.5-flash`; `gemini-3-flash-preview` is ~5x slower on PDFs |
| `--no-attachment-data` | EML/MBOX: drop base64 attachment bodies, keep metadata |
| `--verify` | runtime contract verification |
| `--budget-report` | show capability budget usage |
| `--check` / `--test` / `--prove` / `--eval` | type-check / inline tests / Z3 / golden files |

## 8. Environment

| Variable | Purpose |
|---|---|
| `DOCPARSE_OUTPUT_DIR` | same as `--output-dir` |
| `DOCPARSE_PDF_BACKEND` | default backend, same values as `--pdf-backend` |
| `DOCPARSE_PROCESS_TIMEOUT` | subprocess ceiling for PDF backends (default `20m`) |
| `AILANG_NO_TRACE` | wrapper sets `1`; set `0` to re-enable tracing when debugging |

AI parsing authenticates via Google ADC, not an API key — see §2b.

## 9. Failure modes worth recognising

| Symptom | Cause | Fix |
|---|---|---|
| `could not execute 'uv'` on a PDF | usually a **timeout kill**, not a missing binary | raise `DOCPARSE_PROCESS_TIMEOUT`; confirm `uv` exists before believing the message |
| `no text layer … and OCR found nothing (docling: …)` | scanned PDF **and** `docling` not installed | `docparse --install-backends` (§2b) — this is a missing dep, not a bad PDF |
| Empty / near-empty text from a PDF | scanned or image-only pages | `docling` first (free, local); `--pdf-backend ai` only after asking the user |
| `pdftotext: command not found` | poppler missing | `brew install poppler` / `apt install poppler-utils` |
| `ailang: command not found` | wrapper works, runtime missing | re-run the installer (§2); it installs the runtime |
| `cannot locate docparse/main.ail above …` | wrapper copied away from its sources | re-run the installer (§2) rather than moving files back |
| Batch feels 10x too slow | a shell loop, not batch mode | pass all files or the folder in one invocation |
| Output "went missing" | landed in `docparse/data` inside the clone | pass `--output-dir` |

## 10. Reporting problems

Local-CLI bugs belong to the public parser repo:
<https://github.com/sunholo-data/ailang-parse/issues>. The `submit_feedback`
MCP tool also routes there with `package="sunholo/ailang_parse"`, and works
regardless of which path was in use.
