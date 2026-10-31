# VAR / STRUCT folding and completion coverage

## Findings

The executable function inventory contained 63 functions; the old completion/signature list missed 38. REGION had neither completion nor a snippet. Several accepted types, declaration sections, timer/edge templates and block headings were also absent.

## Changes

- Fold VAR, VAR_INPUT, VAR_OUTPUT, VAR_IN_OUT, VAR_TEMP, VAR_CONSTANT and VAR_STAT through their matching END_VAR. Nested inline STRUCT uses END_STRUCT and can be folded independently. Original source numbers and full-source editor/storage behaviour are preserved.
- A small shared language catalogue supplies primitive/timer types, declaration sections and the current keyword inventory to the parser, highlighting and assistance. Existing parser/runtime behaviour is retained.
- Completion/signature templates derive from all **63 executable function names**, using named arguments for the explicit standard-function API and positional arguments for math/conversion functions.
- Add REGION / END_REGION, IF / ELSIF / ELSE, FOR / BY, TP, F_TRIG, missing VAR sections and FUNCTION_BLOCK / FUNCTION / ORGANIZATION_BLOCK scaffolds. There are **26 structural/call snippets**.
- All **29 accepted types** are suggested. Type contexts favour types/ARRAY/STRUCT instead of inserting an executable timer template. VOID is offered as a function return type.
- Timer member completion includes the mode compatible with TON_TIME / TOF_TIME / TP_TIME, and all three explicit modes for IEC_TIMER. Signature help also handles Polish timer identifiers.
- All **53 catalogue keywords** are reachable through typed prefixes; REGION titles are ordinary text and do not open an expression-completion menu. Icons distinguish types, keywords, functions, methods, variables and snippets.

This is coverage of the currently implemented editor/interpreter subset. It does not add DATA_BLOCK / TYPE definitions, FC/FB calls, hardware instructions or full TIA Portal compatibility. RETAIN / NON_RETAIN remain accepted syntax with no retentive runtime emulation. Adding a snippet does not imply additional runtime features.

## Validation

`npm test`: **92 pass** (80 existing + 12 new).

- Every one of the 63 actual function completion templates is expanded with valid representative arguments, parsed and evaluated; named/positional style and signature help are checked.
- Every accepted type and declaration section is suggested and parsed. All catalogue keywords are reachable and unsupported instruction families remain absent.
- REGION partial-prefix insertion, editable fields and execution are verified. Timer methods and block scaffolds are parsed/executed as appropriate.
- All VAR variants, nested STRUCT, conservative handling of keyword-like field names and full-source execution after folded declaration edits are covered.
- Browser smoke: fold VAR_OUTPUT and VAR, execute the unchanged test result 60; fold VAR_INPUT and VAR, type `reg`, insert REGION with Tab, fill its title/body, compile and execute to Licznik = 1.

## Backup / rollback

Source checkpoint before edits: Sites v8 commit `6def6ae76655ec22456d68e38acdf6c794d67492`, with an independent source copy, checksums and Git bundle.

GitHub backup: `backup/pre-var-completion-2026-10-31` at `83713371ab95f8e20149c229e0edb6e83b2277bc`. The new feature branch is based on `feat/scl-code-folding` while earlier PRs await review. Revert the feature or restore the backup source; project JSON/storage schemas do not change.
