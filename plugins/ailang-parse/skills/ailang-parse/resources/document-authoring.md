# Document authoring and verification

## Local generation

Use this workflow for new documents and deliberate conversion. For precise edits
to an existing Word file, see the editing boundary below first.

1. Check `command -v docparse`. Use an existing installation; do not reinstall
   merely because the skill was newly linked. See local-cli.md if it is missing.
2. Write Markdown in the task's writable directory. Use front matter for title,
   author, and date, and normal Markdown for headings, lists, tables, and images.
3. Choose explicit output paths, and create their parent directories:

```bash
mkdir -p ./output ./parsed ./qa
docparse ./draft.md --convert ./output/report.docx --output-dir ./parsed
```

The conversion filename is controlled by `--convert`. `--output-dir` keeps
parsed intermediates out of the parser installation. Use absolute input/output
paths when invoking from a different working directory. Resolve image paths
before conversion and check that images were actually embedded.

The agent can author Markdown directly; `--generate` is not required. That flag
invokes an additional AI backend and is a separate choice about provider access.

## DOCX reference templates

When a user supplies a letterhead or reference DOCX, use it as the design source:

```bash
docparse ./draft.md --convert ./output/report.docx --output-dir ./parsed \
  --reference-doc ./letterhead.docx
```

The reference supplies styles, numbering, theme, embedded fonts, headers,
footers, and page setup. The new document supplies body content and title/author
properties. Template body text and template comments are not retained. The
reference's headers and footers take precedence over those in the source.

For a multi-section template, `--reference-section N` selects the section for
page setup and headers/footers (one-based; default is the last section).
`--table-style NAME` binds generated tables to a template table style. Check the
installed CLI's supported flags before relying on features from newer releases.
An unreadable/non-DOCX reference must not silently become generic styling.

These section and table options apply to DOCX output. Current AILANG Parse main
also supports ODT, PPTX and HTML styling references; check installed-version
support and see template-inspection.md. Do not promise that the
template's body layout or every feature of an existing document will survive
regeneration. Inspect the final rendering.

## Structural and visual verification

After conversion, check that the requested file exists and parse it back:

```bash
docparse ./output/report.docx --output-dir ./qa/parsed
```

Check content that matters to the request: headings, table dimensions and cell
values, list structure, images, and supported comments or tracked changes.
Parsing validates structure; it cannot establish pagination or visual fidelity.

For paginated documents and slides, render the latest output and inspect every
page or slide. Look for clipping, overlap, missing glyphs/images, broken tables,
unintended blank pages, awkward page breaks, and misplaced headers or footers.
Fix the content/template or use an appropriate editing tool, regenerate, and
render again after layout-sensitive changes.

Use the local companions shipped by AILANG Parse:

```bash
mkdir -p ./qa
bash "$DOCPARSE_SKILL_DIR/scripts/audit.sh" ./output/report.docx > ./qa/audit.json
bash "$DOCPARSE_SKILL_DIR/scripts/render.sh" ./output/report.docx --output-dir ./qa/render-1
# For an edit, compare before and after with the same renderer and DPI:
bash "$DOCPARSE_SKILL_DIR/scripts/render.sh" ./before.docx --compare ./output/report.docx --output-dir ./qa/comparison-1
```

`render.sh` needs LibreOffice and Poppler (`pdftoppm`) for Office input; PDF
input needs only Poppler. Rendering, raster comparison and audits run in AILANG;
no Python or Pillow is needed. Explicit `--soffice` and `--pdftoppm` paths override
executable discovery. `--timeout` (seconds, default 120) bounds each subprocess; `--dpi` controls page
resolution. The output directory must be new, preventing stale QA reuse.

The manifest records input hashes, tool paths, page directories and comparison
findings. Comparison hashes uncompressed Poppler rasters to identify changed,
added and removed pages; inspect the two PNG sets side by side. It does not
produce diff overlays or align paragraphs across pagination changes.
`visual_review: pending` is intentional: the agent must actually inspect every
image. The audit is read-only, reports limited structural checks, and returns
exit 2 for unreadable input; `--strict` returns exit 1 for findings. A warning
about a table header needs semantic review, not an automatic fix.

When the Codex Documents skill is used, follow its runtime and rendering
requirements, using its packaged renderer instead if required. Resolve its
installed paths rather than embedding a versioned cache location here.

If local companions are missing, use an available renderer/native application or
report incomplete visual verification. Do not upload documents as a fallback.
The wrappers accept `DOCPARSE_RENDER_BIN` / `DOCPARSE_AUDIT_BIN` for a checkout's
executables. Keep QA files separate and deliver only requested formats.

For spreadsheets, parsing is also not evidence that formulas recalculate or
charts are correct. Use spreadsheet-specific calculation and inspection tools
when those features are part of the task.

## Existing Word documents and specialised edits

Do not rebuild an existing document through Markdown for a precise redline,
comment insertion, form/content-control edit, field update, or layout-sensitive
patch. Markdown cannot express those features. Use available Documents/OOXML
helpers or a native editing tool, then verify both structure and rendering.

Docparse can extract supported comments and tracked changes and preserve them
in supported document conversions. That is different from authoring new review
markup. The hosted `editDocument` tool returns modified blocks, not a finished
DOCX; it still needs an appropriate generation step.

Preserve the original file and use a new output filename unless the user asks
to replace it. Do not let a generic formatting preset override a supplied
template or an explicitly chosen editing workflow.
