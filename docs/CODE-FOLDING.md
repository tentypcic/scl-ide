# Structural SCL folding

## Behaviour

- Gutter arrows collapse and expand IF, FOR, WHILE, REPEAT, CASE and REGION, including nested structures. ELSE/ELSIF stay inside their IF; CASE arms stay inside CASE.
- `Zwiń` / `Rozwiń` act on all complete ranges. Ctrl+Shift+[ / Ctrl+Shift+] act on the enclosing block at the cursor. The collapsed header has a clickable hidden-line count.
- Source numbers remain original; fold controls and breakpoint controls are separate. A collapsed block indicates a breakpoint inside it.
- Error navigation, instruction stepping and a breakpoint inside a fold reveal the necessary ancestors. Normal cyclic execution can keep the code folded.
- Full source remains the input to compilation, assistance, project storage, history, formatting and export. Folding changes only the displayed rows.
- Editing outside a fold preserves its body. Editing into its body reveals it. Delete/Backspace at a collapsed gap first expands the block rather than deleting hidden lines.
- Copy/cut across folded ranges includes selected hidden source. This includes a folded terminal block without a final newline. Undo/redo retain the full source; consecutive typing is grouped. The undo buffer is bounded to 100 entries / approximately four million source characters and resets on switching programs.
- Folds are session-only view state. Switching programs or reloading starts expanded. Malformed/unmatched blocks are treated conservatively; this is not new interpreter syntax support.

## Implementation

`folding-core.js` masks strings, quoted names and comments while preserving UTF-16 offsets, finds matched structural ranges, and maps displayed rows/offsets to full source. It works on incomplete code without executing it. REGION titles are not parsed as statements.

`code-folding.js` adapts the existing textarea instead of migrating editors in this change. Native textarea content is projected; its application-facing value and selection APIs remain full-source based. Assist positioning uses the visible prefix. Syntax colours are generated from full-source tokens and filtered by visible source line. Runtime badges, gutter lines and execution highlights use the same row mapping.

## Validation

- `npm test`: **80 passed, 0 failed** (64 existing + 16 folding tests).
- Core regressions: nested pairing, all six kinds, comments/strings/quoted names, incomplete input, original offsets, Unicode, edits that shift folds, selected replacement, EOF boundaries and unchanged execution results.
- Adapter regressions: editing folded text, snippets, safe boundary deletion, undo/redo and typing groups, copy/cut including terminal folds, reveal navigation, document switching.
- Browser smoke: fold IF, type below it, compile and scan to the expected output 60, expand and compare full source; collapse all and stop on hidden line 13; reveal a diagnostic at hidden line 13; copy full folded source; undo/redo; separately collapse FOR and CASE inside REGION.

Browser checks use disposable local-preview programs. No user program in the hosted browser origin is replaced by QA fixtures.

## Backup and rollback

Starting application: Sites v7, source commit `c9acbc6969f75ea72c84bc5e04d6dd0c17c0431b`. An independent checkpoint was created before editing, including uncommitted files, source checksums and Git history.

GitHub backup: `backup/pre-code-folding-2026-10-31` at `43477aabeb15f70acf4ad24296679f21570f0145`. The feature PR is stacked on `feat/trash-and-scl-test-code` while earlier PRs await review. Revert the feature commit or branch from that backup to remove folding. Project JSON/storage schemas are unchanged.
