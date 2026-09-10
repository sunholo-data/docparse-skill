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

Reference templates currently apply to DOCX output. Do not promise that the
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

When the Codex Documents skill is available for DOCX work, use its packaged
`render_docx.py` and its runtime instructions for visual QA. Resolve that skill's
actual installed location; do not hardcode a plugin version, Python runtime, or
LibreOffice path. Follow its applicable render-and-inspect requirements while
preserving the user's choice of docparse for generation. For slides or PDFs,
use the available format-specific renderer and review workflow.

Without those skills, use an available document renderer or native application
to inspect the result. If rendering is unavailable, report that structural
checks passed but visual verification is incomplete; do not claim visual QA.
This skill does not itself bundle a renderer. Keep QA artifacts separate and
deliver only the file formats requested by the user.

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
