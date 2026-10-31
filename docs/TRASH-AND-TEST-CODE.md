# Empty trash and SCL test program

## Changes

- The Files pane shows **Opróżnij kosz**, disabled when the trash is empty.
- Confirmation states the number of programs and recovery scope. Cancel leaves the trash unchanged.
- Confirmation commits the emptied trash and a named **Przed opróżnieniem kosza** snapshot together in one storage write. A failed write preserves the trash and history. The recovery snapshot is named/manual, so normal automatic-history rotation does not evict it.
- Programs disappear from the current trash, but remain in that snapshot. Recover them by restoring the whole project from History. This is not a purge of all historical copies and may not reduce browser storage usage.
- **Kod testowy SCL** creates a separate program from `dist/FB_TestSCL.scl`. Current editor text, other files, trash and DB test data are preserved.
- The sample exercises FOR/BY, WHILE, REPEAT, IF/ELSIF, CASE, EXIT/CONTINUE, an array of structures, TON, conversions, scaling, text and bit operations. [Run instructions and expected values](TEST-SCL.md).

## Validation

`npm test`: **64 passed** (56 existing + 2 trash recovery tests + 6 sample/program-loading tests). Checks include all four CASE outcomes, IF branches, reset/restart edge, Stop during timer wait, array content, loop/text/bit/REAL results, failed storage writes, retained named recovery and preserving pending editor text when opening the sample.

Browser smoke: empty-trash disabled state, new disposable program → trash, cancel, confirm, reload and named snapshot visible; loading the sample retains the earlier program; Start pulse + Run reaches Gotowe TRUE with the expected values.

## Backup / review

Starting application source: Sites v6, commit `06274aa5cbd996b8f062922e1643c049032eafe3`. Independent source checkpoint created before edits with source, Git bundle and checksums.

GitHub recovery branch: `backup/pre-trash-and-test-code-2026-10-31` at the PR #1 head (`3175c4bb44fb0921a852a8e0056e784ba6d89f5f`). This branch/PR builds on `feat/scl-project-history` until PR #1 is merged. Leave both PRs open for user review.

Rollback uses that starting source. Before switching versions, export the current project JSON. This patch leaves the history schema and legacy JSON version unchanged.
