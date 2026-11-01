# Roadmap — measurable SCL milestones

SCL first. Each row is a separate change set, branch, before-change checkpoint and pull request. Existing functions must continue to work.

| Stage | Scope | Acceptance | Status |
| --- | --- | --- | --- |
| M0 | Source access, independent baseline, restore test | Sites v5 commit matched; source restored separately; original 44 tests pass | Done |
| M1 | Project history, named versions, diff, restore, JSON round trip | Recover edited/imported/deleted workspace; write failure retains previous data; reload and restore verified | Implemented on `feat/scl-project-history`; awaiting user review |
| M2 | SCL parser audit and regressions | Nested CASE / loops, incorrect syntax, quoted DB names, stable error ranges; fix found failures | Implemented on `fix/scl-parser-audit`; 23 regressions, 123 total tests; see M2-PARSER-AUDIT.md |
| M3 | Language-service facade and symbol index | Suggestions resolve declarations and scopes; parser can analyse unfinished source without execution | Planned |
| M4 | SCL types and project definitions | DB/UDT/ARRAY references resolve; unsupported runtime constructs remain explicit | Planned |
| M5 | Editor improvements | Compare current editor with Monaco spike using the same completion, formatting and breakpoint scenarios; preserve data and keyboard workflow | Partial: structural folding implemented separately; editor evaluation planned |
| M6 | Debugger refinement | Clear instruction vs scan steps, coherent inline values, watches, condition inspection and source-version handling | Planned |
| M7 | SCL reference checks and release | Real source import/export and documented TIA / PLCSIM checks on a copy of the PLC project | Planned |
| Later | VBS / WinCC adapter | Separate parser and host mock, SmartTags, CSV test fixtures; reuse workspace and history | Deferred until SCL |

## First parser regression

The nested CASE label parsing issue was reproduced and fixed in M2 with execution assertions for the inner/outer branches and continuation. See [the audit](M2-PARSER-AUDIT.md). Continuous analysis, partial-AST recovery and the language-service facade remain M3.

## How progress is assessed

1. Compare the same programs in the before and after versions.
2. Check the task users can now complete, not just test counts.
3. Review the diff, restrictions and screenshots where layout changed.
4. Confirm user programs survived reload and round-trip export/import.
5. Keep a rollback reference for the previous working milestone.

Do not start a large editor migration, parser rewrite and debugger change in the same branch.
