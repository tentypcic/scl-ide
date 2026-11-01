# M2 — SCL parser audit

Date: 2026-10-31. Scope: lexer/parser correctness, bounded parsing and precise error locations. Retain the existing AST interpreter, debugger, folding and browser data format.

## Reproduced failures and fixes

| Input | Before | After |
| --- | --- | --- |
| CASE directly inside a CASE arm | Lookahead mistakes the inner CASE for a new label | Parses/executed with the correct inner ELSE and outer continuation |
| 60-label list following another arm | The 30-token lookahead misses the colon | Uses the same label grammar for lookahead and parsing, without that cutoff |
| Quoted globals named `IF`, `CASE`, `END_CASE` | Values can be mistaken for language delimiters | Only identifiers/operators carry grammar control keys |
| Explicit FB/FC/OB without BEGIN or with missing/wrong ending | Some incomplete sources are accepted | Requires BEGIN and the matching ending; headerless body snippets remain supported |
| `REAL#-1.5e+2`, `DINT#1_000` | Typed lexeme stops early | Recognizes complete exponent/separator notation |
| `2#102`, `8#19`, `16#FG` | `parseInt` can silently truncate to a different value | Rejects malformed digits before building the AST |
| Very deep CASE, expression, type or long left-associated expression | Some paths bypass existing depth limits | Bounded SclError before runtime validation/allocation |
| Array bound beyond the safe integer range | Incrementing an allocation loop can stop progressing | Rejects the unsafe bound before allocation |

The original 17 new audit tests were run against the unchanged baseline: 4 passed and 13 failed. This is evidence of reproduced failures, not an estimate based on test count.

## Source locations and UI

- Tokens retain zero-based UTF-16 `start`/`end` offsets (end exclusive), and one-based `line`, `col`, `endLine`, `endCol`.
- Ranges refer to raw source, including doubled quotes, `$` escapes, CRLF and surrogate pairs. Decoded string values remain separate.
- SclError exposes `range` when its token is known; errors without a source token retain `range: null` rather than inventing a location. EOF has a zero-width range.
- Workspace diagnostics show line/column, select the offending token and reveal it through folded blocks. This is check/run-time feedback; continuous tolerant analysis is M3.
- Declaration completion now creates the appropriate synthetic FC/FB/OB ending so stricter full-block validation does not break suggestions.

## Validation

- Before-change suite: **100/100**.
- Independent checkpoint restored to another directory: **100/100**.
- Final suite: **123/123**, including 23 added parser regressions. Tests exercise nested branch execution, mixed loops, long labels, quoted DB and ARRAY/STRUCT access, malformed syntax/literals, FC/FB/OB suggestions, deterministic ranges, every typing prefix of a nested program, nesting limits and unsafe array bounds.
- Managed Chrome UI: a nested CASE gives result **21** after one cycle. Removing inner OF reports **11:17** and selects token `2`. Folding all blocks and checking again reveals the same error. Restoring the valid source checks and executes successfully.

## Limits and next milestone

This is a targeted audit of the implemented subset, not full Siemens grammar/type/runtime conformance. Parser.parse still reports its first error and does not recover a partial AST. Multi-file DB/UDT resolution, declared constant validation for CASE labels, complete type semantics, all literal forms and hardware instructions remain outside this patch. Syntax nesting is capped at 80 blocks/types and 120 expression recursion/AST levels; unusually large expressions should be split into intermediate assignments.

The lexer supplies token ranges, not complete ranges for every AST node or every field-level semantic error. Existing runtime values can still be visible after a failed check; runtime/source-version presentation belongs to the debugger milestone. No TIA Portal/PLCSIM reference execution was performed. File-picker/download acceptance and mobile verification from the interface audit remain open.

Next: M3 language-service facade and symbol index, with analysis that does not instantiate or execute Machine, versioned results and explicit recovery for incomplete documents. The current parser is retained; no rewrite is justified by this audit alone.

## Reference and rollback

Siemens V20 documents nested CASE and integer label lists/ranges: https://docs.tia.siemens.cloud/r/en-us/v20/scl-s7-1200-s7-1500/program-control-operations-s7-1200-s7-1500/case-create-multiway-branch-s7-1200-s7-1500

Before-change GitHub commit: `dbe2326e13ee6c94e6d95650e6265fbdf874b0d2`, backup branch `backup/pre-parser-audit-2026-10-31`. Before-change Sites source: `b1d33141e7e8b24317348b3c0a5ecd1a3aad83da`, saved Site version 10. An independent source checkpoint, checksums and verified Git bundle were created before edits.

Revert this change or redeploy saved version 10. No browser storage migration is required. Source backups do not contain user programs saved in the browser.
