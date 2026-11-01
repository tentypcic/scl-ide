# Parser regression verification — 1 November 2026

GitHub parser fixes were accepted in Automation IDE PR #8, squash commit `28ff5341bddf47d4b7402d36f86e800e1d69ccd5`.
The Site source at `5d81ca76aac51ccf66c09c7505702aa0115f70f7` already contains the corresponding fixes and later source-range, editor and history work. Its engine was retained rather than replaced with the older GitHub engine.

Added the 20 regression cases from PR #8 to verify nested CASE, loop nesting, label lists, invalid literals and explicit block terminators against this newer Site source.

Validation: `npm test` — 152 passed, 0 failed. No TIA/PLCSIM reference check was performed. No browser-local user project data was modified. An independent 57-file source checkpoint was created before adding the tests.
