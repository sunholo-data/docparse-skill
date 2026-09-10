# Inspect a reference before generation

First establish the requested operation from the user's wording and context:

- **Use its styling for new content:** generate from Markdown with a reference.
- **Fill or revise this exact document:** preserve a copy and edit verified
  locations. Regenerating from Markdown discards body structure and is unsuitable
  for precise redlines, forms, or strict package preservation.

## Inspect only what affects the task

Keep the reference unchanged. Record its absolute path and SHA-256, then inspect
relevant page patterns: title/first page, normal body, tables, later sections,
landscape pages and appendices. Render the reference when layout matters.

For DOCX, run the read-only audit as supporting evidence:

```bash
mkdir -p ./qa
bash "$DOCPARSE_SKILL_DIR/scripts/audit.sh" reference.docx > ./qa/reference-audit.json
```

The audit lists section geometry, table grids, images, comments and fields. It
is not a complete style inventory: inspect styles/theme/numbering and the
relevant package parts if exact font or style bindings matter. Comments may be
invisible in a rendered PDF. A field instruction's presence does not establish
that its cached page number or TOC is current.

For a complex template, write a short task-local `template-notes.md` containing:

- Reference identity and inspected page/section patterns.
- Page size, margins, columns and relevant first/odd/even header behaviour.
- Paragraph/table style names, fonts, recurring components and image placement.
- What new content replaces and what must be preserved.
- Chosen reference section/table style, unresolved observations, and final checks.

A simple letterhead needs only the relevant notes; do not require a full package
inventory for an ordinary new report. For strict preservation, record hashes of
preserve-only parts and compare them after the edit. Inspect text boxes, table
cells, headers and content controls as well as body paragraphs.

## Generation choices

- DOCX: `--reference-doc letterhead.docx`; `--reference-section N` selects the
  one-based section (default last); `--table-style NAME` binds generated tables.
- Current AILANG Parse main also supports ODT references, PPTX theme/master
  references and HTML CSS/shell references. Check the installed CLI's help before
  relying on unreleased features. These are styling operations, not exact body
  or slide-layout reproduction. DOCX section/table flags do not apply to them.
- The template's body/comments do not become new DOCX content. Its headers and
  footers take precedence over source headers/footers.

## Verify the result

Render final output to a fresh directory and inspect every page. For edits with
preservation requirements, use `render.sh ... --compare ...` as evidence of
changes, not an automatic pass/fail judgement: changed text legitimately moves
pages. Investigate movement outside the intended edit, missing recurring
components, changed geometry or missing package parts.

Check fields, comments and relationships structurally too. Refresh fields in an
appropriate editor when required; do not flatten live fields or accept tracked
changes merely to obtain a cleaner render. State any deferred field refresh.
